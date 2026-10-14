# Frontend regression tests

One test file per fixed bug. CI runs them with the rest of `npm run test:ci`; run just these with `npm run test:regression`.

- Name: `issue-<number>-<short-slug>.test.tsx`, with the GitHub issue link on the first line.
- Write the test first and watch it fail against the unfixed code, then fix.
- Stay offline: mock `lib/api` (see `src/test/adminDashboardMocks.ts`) or Supabase (`src/test/supabaseMock.ts`), and render with `renderWithProviders`. `fetch`/XHR throw.
- Assert what the user sees and what is requested (labels, rows, query params), using roles/text rather than CSS classes where possible.
- Do not delete or weaken a regression test to make CI pass.

Files without an issue number predate this convention; replace their `Issue:` placeholder with the real link.
