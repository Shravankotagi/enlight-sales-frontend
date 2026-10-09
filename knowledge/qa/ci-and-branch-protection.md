# CI and branch protection

## Workflows
Each repo (`em-os-backend`, `em-os-bot`, `em-os-frontend`) has `.github/workflows/ci.yml`.

- Triggers: pull requests targeting `main` or `main_test_2`, pushes to those branches, and manual `workflow_dispatch`.
- Node 22, `npm ci` from the tracked `package-lock.json`, npm cache enabled. A newer push to the same ref cancels the older run.
- No secrets. Backend uses a placeholder `DATABASE_URL` only so `prisma generate` succeeds; frontend build uses placeholder `VITE_*` values. CI never deploys.
- Coverage reports are uploaded as artifacts (`backend-coverage`, `frontend-coverage`, kept 7 days).

| Repo | Jobs |
|---|---|
| Backend | `Lint`, `Build`, `Unit + regression tests` |
| Bot | `Syntax check`, `Unit + regression tests` |
| Frontend | `Lint (changed files)`, `Typecheck`, `Unit + regression tests`, `Build` |

Every workflow ends with an aggregate job named **`ci`** that fails unless every other job succeeded. Branch protection should require only `ci`, so adding or renaming jobs never needs a settings change.

Frontend lint only gates files changed by the PR (diffed against the merge base) because the repo still has pre-existing ESLint errors. Fix those files as you touch them; once `npm run lint` is clean, switch the job to the full lint.

## Branch protection (manual setup, per repo)
GitHub → repo **Settings → Branches → Add branch ruleset** (or classic **branch protection rule**) for `main`:

1. Require a pull request before merging (at least 1 approval recommended).
2. Require status checks to pass → add **`ci`**. It appears in the search list after the workflow has run once on a PR.
3. Require branches to be up to date before merging.
4. Block force pushes and deletions.
5. Optionally apply the same rule to `main_test_2`.

Repeat for all three repos. Until this is configured, CI reports results but does not block merges.

## When CI fails
- Reproduce locally with the commands in [test-inventory.md](test-inventory.md); they need no `.env`.
- `NetworkAccessError` means a test reached a real client; mock it (Supabase builder, `loadWithMocks`, or `vi.mock`) instead of allowing network.
- Do not skip, delete, or weaken a regression test to get green; fix the code or update the test intentionally in the same PR.
