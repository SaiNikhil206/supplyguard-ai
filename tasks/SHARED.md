# Tasks - Shared (whole team)

Each shared task has one **driver** who is accountable; everybody contributes.

> Same format as the personal task files - `scripts/progress.py` parses it.

## Handoff
- **Last updated:** 2026-11-19 (setup)
- **Current task:** S-01
- **Branch:** -
- **Where I left off:** Contracts v0.1 drafted in `docs/CONTRACTS.md`.
- **Next step:** 30-min call: walk through CONTRACTS, agree changes, Roop tags v1.
- **Blockers:** none

---

### S-01: Freeze contracts v1
- **Status:** in-progress
- **Sprint:** S0 (19-20 Nov) | **Est:** 0.5d | **Depends:** -
- **Driver:** Roop
- **Branch:** `roop/S-01-contracts`
- **Model hint:** opus / high
- **Deliverables:** `docs/CONTRACTS.md` v1 agreed by all three; changelog entry.
- **Acceptance:**
  - [ ] Nikhil approved sections 6-7
  - [ ] Uday approved sections 1, 2, 4
  - [ ] Roop approved sections 3, 5, 8
- **Done in:** -
- **Notes:** -

### S-02: Sprint-end integration demos
- **Status:** todo
- **Sprint:** every sprint (23 Nov, 30 Nov, 7 Dec, 14 Dec, 20 Dec, 26 Dec) | **Est:** 1h each | **Depends:** -
- **Driver:** Roop
- **Branch:** -
- **Model hint:** haiku / low (`/status all` to prepare)
- **Deliverables:** merge `collaboration` -> `main`, tag `m1`..`m6`, 15-min demo of the milestone in `docs/PROJECT_PLAN.md`, notes appended to `progress/SESSION_LOG.md`.
- **Acceptance:**
  - [ ] m1 (S0) [ ] m2 (S1) [ ] m3 (S2) [ ] m4 (S3) [ ] m5 (S4) [ ] m6 (S5)
- **Done in:** -
- **Notes:** -

### S-03: End-to-end demo dry run
- **Status:** todo
- **Sprint:** S5 (24 Dec) | **Est:** 0.5d | **Depends:** R-09, N-08, U-09
- **Driver:** Nikhil
- **Branch:** -
- **Model hint:** -
- **Deliverables:** full 7-scene run on hosted environment, list of issues filed as tasks.
- **Acceptance:**
  - [ ] Completed without manual DB edits
- **Done in:** -
- **Notes:** -

### S-04: Security review
- **Status:** todo
- **Sprint:** S5 (22-23 Dec) | **Est:** 0.5d | **Depends:** U-03, R-10
- **Driver:** Uday
- **Branch:** `uday/S-04-security-review`
- **Model hint:** opus / high (run `/security-review` on the branch diff)
- **Deliverables:** checklist from BRD 15.5 verified; no secrets in repo/logs; findings fixed or filed.
- **Acceptance:**
  - [ ] TC-10 passes, secrets scan clean, every BRD 15.5 bullet has evidence
- **Done in:** -
- **Notes:** -

### S-05: Final submission package
- **Status:** todo
- **Sprint:** S6 (27-31 Dec) | **Est:** 1d | **Depends:** R-12, N-12, U-13
- **Driver:** Roop
- **Branch:** `roop/S-05-submission`
- **Model hint:** opus / high review, haiku / low checklist
- **Deliverables:** demo video, deck, Marketplace package, README polish, `docs/TEST_REPORT.md` final, submission form, tag `v1.0`.
- **Acceptance:**
  - [ ] Submitted before 31 Dec 2026
- **Done in:** -
- **Notes:** -
