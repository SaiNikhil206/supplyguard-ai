---
description: Verify a task meets its acceptance criteria, mark it done, push and open a PR to collaboration
argument-hint: <task-id e.g. R-06>
model: opus
---
Complete task **$ARGUMENTS**.

1. Find the task block in `tasks/*.md`. Make sure you are on its branch and it is rebased on `collaboration` (`git fetch && git rebase origin/collaboration`).
2. `test-runner`: run all suites affected (backend pytest, frontend test+build, mock-erp tests, as relevant). All must pass.
3. `reviewer` on the branch. Any blocker -> fix it (delegate to `implementer`) and repeat steps 2-3. Do not continue with open blockers.
4. Walk the acceptance criteria one by one; tick each box only with evidence (test name, file:line, Boomi TEST_LOG line, screenshot path). If any criterion is not met, set `Status: review` (or keep `in-progress`), explain what's missing, run `/handoff` and stop.
5. If all met: set `Status: done`; commit; then set `Done in:` to that commit's short hash in a follow-up edit; update the Handoff block (next task = what `python scripts/progress.py <member>` now reports as NEXT); append to `progress/SESSION_LOG.md`; `python scripts/progress.py all --write`.
6. Commit with trailers `Task: <ID>` / `Status: done` / `Member: <member>`; push.
7. Open PR `<ID>: <title>` -> `collaboration` with the template (acceptance table + reviewer verdict + test output summary). If `gh` is unavailable, print the GitHub compare URL.
8. If the contract file changed, say so loudly and list who must be notified.
Report: PR link, tests, next task for this member.
