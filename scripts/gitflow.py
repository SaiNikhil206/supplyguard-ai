#!/usr/bin/env python3
"""Git automation for the SupplyGuard AI team.

    python scripts/gitflow.py automerge <branch> [--install]
        CI (auto-merge workflow). Merges a task branch into `collaboration` when its task
        status (in tasks/<MEMBER>.md on that branch) is `review` or `done`, the merge is clean
        (or only PROGRESS.md / SESSION_LOG.md conflict) and scripts/run_checks.py passes.

    python scripts/gitflow.py sync-branches
        CI (after every change on `collaboration`). Merges the latest `collaboration` into every
        open task branch on GitHub so everybody works on top of the newest code.

    python scripts/gitflow.py local-sync [--quiet]
        Local (SessionStart hook, /resume, /sync). Updates your local `collaboration`, pulls your
        own task branch from GitHub and merges the latest `collaboration` into it. Never touches
        a dirty working tree; aborts cleanly on a real conflict and tells you to run /sync.

Exit codes: 0 ok/skipped, 2 conflict needs a human/Claude, 3 checks failed, 1 unexpected error.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import progress  # noqa: E402

BASE = "collaboration"
TASK_BRANCH_RE = re.compile(r"^(roop|nikhil|uday)/([RNUS]-\d{2})-[A-Za-z0-9._-]+$")
MERGEABLE = {"review", "done"}
AUTO_RESOLVE = {"PROGRESS.md", "progress/SESSION_LOG.md"}
CONFLICT_RE = re.compile(r"<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n", re.S)


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    r = subprocess.run(["git", *args], cwd=ROOT, text=True, encoding="utf-8",
                       errors="replace", capture_output=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed:\n{r.stderr.strip() or r.stdout.strip()}")
    return r


def out(*args: str) -> str:
    return git(*args).stdout.strip()


def summary(text: str) -> None:
    print(text)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(text + "\n")


def set_output(key: str, value: str) -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"{key}={value}\n")


def is_task_branch(branch: str) -> bool:
    return "--" not in branch and bool(TASK_BRANCH_RE.match(branch))


def is_ancestor(a: str, b: str) -> bool:
    return git("merge-base", "--is-ancestor", a, b, check=False).returncode == 0


def remote_exists(branch: str) -> bool:
    return git("rev-parse", "--verify", "--quiet", f"refs/remotes/origin/{branch}", check=False).returncode == 0


def task_on_branch(branch: str) -> progress.Task | None:
    member, tid = TASK_BRANCH_RE.match(branch).groups()
    owner = "shared" if tid.startswith("S-") else member
    r = git("show", f"origin/{branch}:tasks/{progress.MEMBERS[owner]}", check=False)
    if r.returncode != 0:
        return None
    tasks, _ = progress.parse_text(owner, r.stdout)
    return next((t for t in tasks if t.id == tid), None)


def resolve_known_conflicts() -> list[str]:
    """Auto-resolve conflicts in generated / append-only files. Returns files still conflicted."""
    files = [f for f in out("diff", "--name-only", "--diff-filter=U").splitlines() if f]
    left = [f for f in files if f not in AUTO_RESOLVE]
    if left:
        return left
    for f in files:
        p = ROOT / f
        if f == "progress/SESSION_LOG.md":  # append-only: keep both sides
            text = p.read_text(encoding="utf-8")
            text = CONFLICT_RE.sub(lambda m: m.group(1).rstrip("\n") + "\n\n" + m.group(2), text)
            p.write_text(text, encoding="utf-8")
        else:  # PROGRESS.md: take ours now, regenerated afterwards
            git("checkout", "--ours", "--", f)
        git("add", "--", f)
    return []


def regenerate_progress(message: str) -> None:
    subprocess.run([sys.executable, str(ROOT / "scripts" / "progress.py"), "all", "--write"],
                   cwd=ROOT, capture_output=True, check=False)
    if git("diff", "--quiet", "--", "PROGRESS.md", check=False).returncode != 0:
        git("add", "PROGRESS.md")
        git("commit", "-m", message)


# ---------------------------------------------------------------- automerge (CI)
def automerge(branch: str, install: bool) -> int:
    branch = branch.removeprefix("refs/heads/").removeprefix("origin/")
    set_output("merged", "false")
    if not is_task_branch(branch):
        summary(f"skip: `{branch}` is not a task branch (sub-branches `--x` merge into their task branch first)")
        return 0
    git("fetch", "origin", "--prune")
    if not remote_exists(branch):
        summary(f"skip: `{branch}` no longer exists on origin")
        return 0
    task = task_on_branch(branch)
    if task is None:
        summary(f"skip: task for `{branch}` not found in its task file")
        return 0
    if task.status not in MERGEABLE:
        summary(f"skip: {task.id} is `{task.status}` - auto-merge waits for `review` or `done` (set by /done)")
        return 0
    member = branch.split("/")[0]
    msg = (f"merge: {task.id} {task.title} (auto-merge)\n\n"
           f"What: Auto-merged {branch} into {BASE}: clean merge and green checks.\n"
           f"Left: {'-' if task.status == 'done' else 'task still in review'}\n\n"
           f"Task: {task.id}\nStatus: {task.status}\nMember: {member}\n")

    for attempt in range(1, 4):
        git("fetch", "origin", "--prune")
        if is_ancestor(f"origin/{branch}", f"origin/{BASE}"):
            summary(f"skip: `{branch}` is already merged into `{BASE}`")
            break
        git("checkout", "-B", BASE, f"origin/{BASE}")
        r = git("merge", "--no-ff", "--no-edit", "-m", msg, f"origin/{branch}", check=False)
        if r.returncode != 0:
            left = resolve_known_conflicts()
            if left:
                git("merge", "--abort", check=False)
                summary(f"CONFLICT: `{branch}` -> `{BASE}` in: {', '.join(left)}.\n"
                        f"Fix: the branch owner runs `/sync` in Claude Code (it resolves conflicts) and pushes - "
                        f"auto-merge retries on that push. Or anyone runs `/merge-prs`.")
                return 2
            git("commit", "--no-edit", "-m", msg)
        checks = subprocess.run([sys.executable, str(ROOT / "scripts" / "run_checks.py")]
                                + (["--install"] if install else []), cwd=ROOT)
        if checks.returncode != 0:
            summary(f"CHECKS FAILED for `{branch}` merged onto `{BASE}` - nothing pushed. "
                    f"Fix on the task branch and push again.")
            return 3
        regenerate_progress("chore(progress): regenerate PROGRESS.md after auto-merge [skip ci]")
        if git("push", "origin", f"{BASE}:{BASE}", check=False).returncode == 0:
            summary(f"merged: `{branch}` ({task.id}, {task.status}) -> `{BASE}` @ {out('rev-parse', '--short', 'HEAD')}")
            set_output("merged", "true")
            break
        print(f"push rejected (collaboration moved), retry {attempt}/3")
    else:
        summary(f"FAILED: could not push `{BASE}` after 3 attempts")
        return 1

    if task.status == "done":
        doomed = [branch] + [ref.removeprefix("origin/") for ref in
                             out("for-each-ref", "--format=%(refname:short)", f"refs/remotes/origin/{branch}--*").splitlines()]
        for b in filter(None, doomed):
            git("push", "origin", "--delete", b, check=False)
        summary(f"deleted done branches: {', '.join(doomed)}")
    return 0


# ---------------------------------------------------------------- sync-branches (CI)
def sync_branches() -> int:
    git("fetch", "origin", "--prune")
    rows = []
    refs = out("for-each-ref", "--format=%(refname:short)", "refs/remotes/origin").splitlines()
    for ref in refs:
        branch = ref.removeprefix("origin/")
        if not is_task_branch(branch):
            continue
        if is_ancestor(f"origin/{BASE}", ref):
            rows.append((branch, "up to date"))
            continue
        git("checkout", "-B", "_sync", ref)
        r = git("merge", "--no-edit", "-m", f"chore(sync): merge {BASE} into {branch} [skip ci]",
                f"origin/{BASE}", check=False)
        if r.returncode != 0:
            left = resolve_known_conflicts()
            if left:
                git("merge", "--abort", check=False)
                rows.append((branch, f"CONFLICT in {', '.join(left)} - owner runs /sync"))
                continue
            git("commit", "--no-edit")
        pushed = git("push", "origin", f"_sync:refs/heads/{branch}", check=False).returncode == 0
        rows.append((branch, "synced" if pushed else "push rejected (branch moved) - next run retries"))
    git("checkout", "--detach", f"origin/{BASE}", check=False)
    git("branch", "-D", "_sync", check=False)
    summary("| Task branch | Sync with collaboration |\n|---|---|\n" +
            "\n".join(f"| {b} | {s} |" for b, s in rows) if rows else "no open task branches")
    return 0


# ---------------------------------------------------------------- local-sync (developer machine)
def local_sync(quiet: bool) -> int:
    def say(msg: str) -> None:
        print(f"[auto-pull] {msg}")

    if git("fetch", "origin", "--prune", check=False).returncode != 0:
        say("offline or no access to origin - skipped")
        return 0
    branch = out("branch", "--show-current")
    dirty = bool(out("status", "--porcelain", "--untracked-files=no"))
    if branch != BASE and git("rev-parse", "--verify", "--quiet", f"refs/heads/{BASE}", check=False).returncode == 0:
        git("fetch", "origin", f"{BASE}:{BASE}", check=False)  # fast-forward local collaboration if possible
    if not branch:
        say("detached HEAD - nothing to pull")
        return 0
    if dirty:
        say(f"`{branch}` has uncommitted changes - auto-pull skipped. Commit, then run "
            f"`python scripts/gitflow.py local-sync` or /sync.")
        return 0
    if branch == BASE:
        r = git("merge", "--ff-only", f"origin/{BASE}", check=False)
        say(f"`{BASE}` " + ("up to date with GitHub" if r.returncode == 0 else
                             "has local commits not on GitHub - never commit to it directly; move them to a task branch"))
        return 0
    steps = []
    if remote_exists(branch) and not is_ancestor(f"origin/{branch}", "HEAD"):
        r = git("merge", "--no-edit", f"origin/{branch}", check=False)
        if r.returncode != 0 and resolve_known_conflicts():
            git("merge", "--abort", check=False)
            say(f"conflict pulling origin/{branch} - run /sync to resolve")
            return 2
        if r.returncode != 0:
            git("commit", "--no-edit")
        steps.append(f"pulled origin/{branch}")
    if not is_ancestor(f"origin/{BASE}", "HEAD"):
        r = git("merge", "--no-edit", "-m", f"chore(sync): merge {BASE} into {branch}", f"origin/{BASE}", check=False)
        if r.returncode != 0:
            if resolve_known_conflicts():
                git("merge", "--abort", check=False)
                say(f"conflict merging latest {BASE} into `{branch}` - run /sync to resolve (nothing changed)")
                return 2
            git("commit", "--no-edit")
        steps.append(f"merged latest {BASE}")
    if steps or not quiet:
        say(f"`{branch}`: " + (", ".join(steps) if steps else f"already up to date with origin and {BASE}")
            + (" - push when ready" if f"merged latest {BASE}" in steps else ""))
    return 0


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("automerge")
    m.add_argument("branch")
    m.add_argument("--install", action="store_true", help="install test dependencies first (CI)")
    sub.add_parser("sync-branches")
    ls = sub.add_parser("local-sync")
    ls.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    try:
        if a.cmd == "automerge":
            return automerge(a.branch, a.install)
        if a.cmd == "sync-branches":
            return sync_branches()
        return local_sync(a.quiet)
    except RuntimeError as e:
        print(f"[gitflow] {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
