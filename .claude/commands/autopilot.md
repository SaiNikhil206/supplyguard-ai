---
description: Hands-free mode - keep checking for a ready task and work it as soon as its dependencies are done (run as /loop /autopilot <member>)
argument-hint: <roop|nikhil|uday>
model: opus
---
Autopilot for team member: **$ARGUMENTS**

Start it once per day with **`/loop /autopilot <member>`** and leave Claude Code open. Each round is cheap when nothing is ready (one script call), and the moment a teammate's task that blocks you is merged, Claude starts your next task by itself.

Each round:

1. **Member.** First word of the arguments (roop / nikhil / uday); else `git config user.name`; else ask once.
2. **Pull.** `python scripts/gitflow.py local-sync --quiet`. If the tree is dirty from work this session started, commit it first as WIP with the CLAUDE.md trailers (`Status: in-progress`, `Left:` line) - never discard anything.
3. **Check.** `python scripts/progress.py <member> --ready`
   - exit 0 `READY (start|continue): <ID> ...` -> step 4.
   - exit 3 `WAITING ...` -> step 5.
   - `ALL DONE` -> say so, run `/handoff` if anything changed, and stop the loop.
4. **Work.** Follow the `/resume <member> <ID>` procedure (explain the task in the member's terms, plan, subagents, tests, reviewer). It ends with `/done`, which merges into `collaboration` (or the auto-merge Action does on push) and moves on to the next ready task. When nothing more is ready, go to step 5.
   - **Human-only steps** (clicks in the Boomi platform, a team call, credentials, a licence): do everything Claude can (specs in `boomi/`, code, tests), then tell the user in 3-5 lines exactly what to do and where, set the task `Status: blocked` with Notes `needs <member>: <action>`, `/handoff` (push), and continue with the next ready task. Re-check it in later rounds: when the user says it is done, or the evidence is in the repo, finish the task.
5. **Wait.** Print one line, e.g. `Waiting: R-02 needs U-03 (uday, todo), U-04 (uday, todo) - next check in 5 min`. Never start another member's task. Make sure nothing is left unpushed (`/handoff` if this session changed anything since the last push).
   - Inside `/loop`: schedule the next round. Use about 5 minutes (300 s) while blockers are `in-progress` or `review`; about 20-30 minutes (1200-1800 s) when every blocker is still `todo` or nothing changed for the last hour. Pass the same `/autopilot <member>` prompt back.
   - Not inside `/loop`: tell the user to start `/loop /autopilot <member>` for hands-free mode.

Rules: everything in CLAUDE.md still applies (own folders only, merge never rebase, never force-push, reviewer before done, `/handoff` before any long wait). Stop the loop if the user says stop, if the same failure repeats 3 rounds in a row (report it), or if the context is getting long (`/handoff`, then tell the user to start a fresh session with the same `/loop /autopilot <member>`).
