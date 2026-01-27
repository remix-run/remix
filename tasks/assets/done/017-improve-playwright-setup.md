### Improve Playwright test setup

Decoupled Playwright tests from the demo and improved test organization.

**Acceptance Criteria:**

- [x] Move E2E tests to `e2e/` folder
- [x] Rename to `*.playwright.ts` pattern
- [x] Ensure E2E tests not published to npm (excluded in `files`)
- [x] Create self-contained test fixture (temp directory with plain TS files)
- [x] Tests create their own server, don't depend on demos/
- [x] Run with `pnpm --filter @remix-run/assets-middleware run test:e2e`
