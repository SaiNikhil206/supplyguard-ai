# Git Workflow

## Branch tree
```
main                                   milestone releases only (tags m1..m6, v1.0)
 └── collaboration                     integration branch, always runnable, default for daily work
      ├── uday/U-06-event-intake       one branch per task
      │    └── uday/U-06-event-intake--boomi-client     optional sub-branch (parallel subagent / worktree)
      ├── nikhil/N-04-impact-engine
      └── roop/R-01-frontend-scaffold
```
Git cannot have both `a/b` and `a/b/c` as branch names, so sub-branches use `--<sub>` suffix, not a slash.

## Daily flow
```powershell
git checkout collaboration
git pull
git checkout -b uday/U-03-core-models        # or: git checkout uday/U-03-core-models && git rebase collaboration
# ... work, commit with trailers ...
git push -u origin uday/U-03-core-models
gh pr create --base collaboration --title "U-03: core data model + seed loader"
```
Or simply `/resume uday` and `/done U-03` in Claude Code.

## Commit message
```
<type>(<scope>): <summary in imperative, <= 72 chars>

What: what changed.
Left: what is not done yet / next step (required when Status is in-progress).

Task: U-03
Status: in-progress | review | done | blocked
Member: uday
```
Types: feat, fix, test, docs, refactor, chore, ci. Scope = app or folder (`integrations`, `frontend`, `boomi`, `tasks`).

## Pull requests and merging (Claude merges)
- Base: `collaboration`. Title: `<TASK-ID>: <title>`. Template in `.github/pull_request_template.md`.
- Every member is a repo admin; the team agreed that **Claude verifies and merges PRs itself** - no waiting for a human approval.
- Merge gate: rebased on latest `collaboration`, conflicts resolved, tests green (CI once `ci.yml` exists), `reviewer` subagent verdict APPROVE in the PR, task status `review` or `done`.
- `/done <ID>` merges the current task and continues with the next one. `/merge-prs` verifies and merges every ready PR/branch for the whole team (run it any time, e.g. start of day).
- Merge method: "Create a merge commit" (`gh pr merge --merge --delete-branch`). Squash is NOT used - keep commits so trailers stay in history.
- After merge, the task branch and its `--<sub>` branches are deleted.

## Conflicts
`/sync` rebases your branch on `collaboration`. Rules (Claude applies them automatically):
- your own folders -> resolve, keeping both intents;
- another member's folders -> take theirs, unless both sides only added lines (keep both), and note it in the Handoff Blockers line for them;
- `docs/CONTRACTS.md` -> keep both if they do not contradict + changelog line; if they contradict, stop and ask;
- `PROGRESS.md` -> regenerate.

## Milestones (S-02)
At the end of each sprint that sprint's S-02 driver (rotating, see `tasks/SHARED.md`) merges `collaboration` -> `main` via PR and tags `m1`..`m6`. Final: `v1.0` on 31 Dec.

## Recommended GitHub settings (any repo admin, once)
- Default branch: `collaboration`.
- Protect `main` and `collaboration`: require PR, 0 required approvals (Claude merges), require CI (`ci.yml`) once it exists, no force push, no deletion. If a rule still blocks a merge, admins merge with `gh pr merge --admin`.
- Allow "Rebase and merge" and "Create a merge commit".
