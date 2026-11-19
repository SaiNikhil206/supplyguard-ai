# boomi/marketplace/ - SupplyGuard AI accelerator package

Owner: **Roop** (R-12). Uday and Nikhil package their own Boomi processes and agents (U-10, N-09); Roop assembles the final package.

Status: **draft**. Everything that does not depend on the Boomi exports is written. Items marked `PLACEHOLDER` wait for U-10 / N-09 exports, R-10 screenshots and the dry run.

## What is in this folder

| Path | Purpose | State |
|---|---|---|
| `LISTING.md` | Marketplace listing text (title, descriptions, features, services, prerequisites, support/licence) | draft |
| `INSTALL_GUIDE.md` | Step-by-step install into a clean Boomi account | draft, component names are placeholders |
| `ARCHITECTURE.md` | Mermaid architecture + data flow for one disruption | draft |
| `COMPONENTS.md` | Table of Boomi components to package, owner, source task, status | all TODO |
| `DRY_RUN_CHECKLIST.md` | Checklist for the acceptance dry run (Nikhil or Uday) | ready |
| `config/environment-extensions.example.json` | Boomi environment extension template (placeholders only) | draft |
| `config/saas.env.example` | SaaS app env template for the Boomi connection (placeholders only) | draft |
| `sample-data/README.md` | Points to `data/` seed + scenarios and how to load them | draft |
| `screenshots/` | `*.png` for the listing - **not created yet**, captured in R-10 | PLACEHOLDER |
| `exports/` | Boomi component exports / package zips - **not created yet**, supplied by Uday (U-10) and Nikhil (N-09) | PLACEHOLDER |

## How to assemble the final zip

Do this only when `COMPONENTS.md` has no `TODO` rows left and the screenshots exist.

1. Pull `collaboration` into the task branch (`git merge origin/collaboration`).
2. Collect exports from Uday and Nikhil into `boomi/marketplace/exports/` (one folder per owner, filenames as listed in `COMPONENTS.md`). Update each row's status in `COMPONENTS.md`.
3. Add the screenshots from R-10 to `boomi/marketplace/screenshots/` and make sure every file listed in `LISTING.md` exists.
4. Replace every `PLACEHOLDER` in `INSTALL_GUIDE.md` and `LISTING.md` with the real component names, topic names, URLs and versions. Search: `grep -rn PLACEHOLDER boomi/marketplace`.
5. Check no secret is present: no real keys, passwords or tenant URLs. Only `*.example` config files ship.
6. Build the zip from the repo root (PowerShell):
   ```powershell
   Compress-Archive -Path boomi/marketplace/* -DestinationPath supplyguard-ai-accelerator.zip
   ```
   Do not commit the zip; attach it to the Marketplace submission.
7. Run the dry run (`DRY_RUN_CHECKLIST.md`) against the zip contents only. Record the result there and in the R-12 task Notes.

## Rules
- No secrets in this folder. Config files are `*.example` with placeholders.
- Do not duplicate `data/` seed files; link to them.
- Do not claim anything in the listing that has not been verified (see `LISTING.md` notes).
