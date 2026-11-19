---
description: Bring the current task branch up to date with collaboration and re-run tests
model: sonnet
---
1. Commit or stash nothing silently - if the tree is dirty, commit it as WIP with trailers (`Status: in-progress`).
2. `git fetch --all --prune` then `git rebase origin/collaboration`.
3. Conflicts:
   - in your own stream's folders -> resolve, keeping both intents;
   - in another member's folders -> take theirs (`collaboration`) and note it in the Handoff Blockers line for them;
   - in `docs/CONTRACTS.md` -> stop, show both versions, ask the user.
4. Run `test-runner` on affected suites. Report results.
5. `git push --force-with-lease` (task branch only - never `collaboration` or `main`).
6. Print what came in from `collaboration` (`git log --oneline ORIG_HEAD..origin/collaboration` style summary, max 10 lines).
