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

## Pull requests
- Base: `collaboration`. Title: `<TASK-ID>: <title>`. Template in `.github/pull_request_template.md`.
- Needs CI green + 1 approval (another member, or paste the `reviewer` subagent verdict if teammates are offline > 12 h).
- Squash merge is NOT used - keep commits so trailers stay in history. Use "Create a merge commit" or "Rebase and merge".
- After merge, delete the task branch.

## Conflicts
`/sync` rebases your branch on `collaboration`. If a conflict is in another member's folder, keep their version and tell them. If it's in `docs/CONTRACTS.md`, stop and agree on it together.

## Milestones (S-02)
At the end of each sprint that sprint's S-02 driver (rotating, see `tasks/SHARED.md`) merges `collaboration` -> `main` via PR and tags `m1`..`m6`. Final: `v1.0` on 31 Dec.

## Recommended GitHub settings (any repo admin, once)
- Default branch: `collaboration`.
- Protect `main` and `collaboration`: require PR, require CI (`ci.yml`) to pass, no force push.
- Allow "Rebase and merge" and "Create a merge commit".
