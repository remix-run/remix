## v0.6.0

### Minor Changes

- BREAKING CHANGE: Removed executable `remix-test.config.ts` and `remix-test.config.js` discovery, along with the `config` path option from `runRemixTest()`. The programmatic `@remix-run/test/cli` API now accepts structured invocation options only. For CLI usage, move static test settings under `remix.json#test`; the main Remix CLI owns JSONC loading, path resolution, validation, and precedence before invoking the test runner (see #11628).

- BREAKING CHANGE: Removed the standalone `remix-test` executable. Use `remix test` for command-line test runs. `runRemixTest()` from `@remix-run/test/cli` now accepts typed runner options such as `type`, `glob`, and `concurrency` instead of an `argv` array, and it no longer reads `process.argv` or handles CLI help (see #11623). The `getRemixTestHelpText()` export was removed along with CLI help handling; `remix test -h` prints the equivalent help text. `@remix-run/test/cli` now exports `remixTestPools` (the supported `pool` values), and `coverage.enabled` accepts `'inherit'` to defer coverage enablement to the config file while still refining other coverage settings.

  ```diff
  - remix-test --type server --concurrency 1
  + remix test --type server --concurrency 1
  ```

  ```diff
   import { runRemixTest } from '@remix-run/test/cli'

   let exitCode = await runRemixTest({
  -  argv: ['--type', 'server', '--concurrency', '1'],
     cwd: process.cwd(),
  +  type: ['server'],
  +  concurrency: 1,
   })
  ```

- Added a `--only` CLI flag and `only` config option to focus tests by matching suite names or full test names without editing source files to add `.only` modifiers.

- Added a `--quiet`/`-q` CLI flag to omit skipped tests from reporter output.

### Patch Changes

- `remix test` now defaults `NODE_ENV` to `test` when it is not already set, so app modules loaded by test files can reliably select test-only resources such as in-memory databases. An explicitly set `NODE_ENV` is preserved (see #11608).

- Fixed `.only` filtering so focused tests and suites apply across the entire test module instead of only within the nearest `describe` block. When `describe.only` and `it.only` are both present, the runner now executes the union of focused suites and focused tests.

## v0.5.0

### Minor Changes

- Add timeout and abort signal support to `@remix-run/test`.

  Tests and lifecycle hooks can now pass `{ timeout, signal }`. Timed-out tests fail and abort `t.signal`, so async work that accepts an `AbortSignal` can cancel promptly. Tests and suites can also use string `skip`/`todo` reasons, and reporters display those reasons when a pending result is reported.

  ```ts
  it('loads data', { timeout: 5_000 }, async (t) => {
    let response = await fetch('/api/data', { signal: t.signal })
    assert.equal(response.status, 200)
  })

  it('depends on external credentials', { skip: 'requires API credentials' }, () => {})
  ```

### Patch Changes

- Ignore browser-cancelled script requests in `remix-test` browser runs so iframe navigation can finish cleanly on Windows while still reporting real script load failures.

## v0.4.2

### Patch Changes

- Fix browser tests so bare package imports resolve with browser and ESM conditions, matching the asset server and avoiding CommonJS entries for packages like `clsx` (see #11478).

- Update the optional `playwright` peer dependency range to match the workspace Playwright catalog version.

- Run browser and E2E tests sequentially within each Playwright project so `remix-test` avoids launching extra browsers at the same time and reduces timing flakes on constrained CI runners.

- Report `beforeAll`, `afterEach`, and `afterAll` hook failures as failed test results so `remix-test` exits non-zero when lifecycle hooks throw.

- Use OS-assigned ports for browser test servers so parallel `remix-test` runs do not fail when the fixed port window is exhausted.

## v0.4.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`node-tsx@0.1.1`](https://github.com/remix-run/remix/releases/tag/node-tsx@0.1.1)
  - [`terminal@0.1.1`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.1)

## v0.4.0

### Minor Changes

- Migrated `@remix-run/test` from the `tsx` package to Remix's internal `@remix-run/node-tsx` module loader.

  BREAKING CHANGE: `.ts`, `.tsx`, and `.jsx` module loading in `@remix-run/test` now uses Remix's internal `@remix-run/node-tsx` loader. Test modules are still transformed before execution, including JSX and TypeScript syntax that requires JavaScript output, but the loader is now maintained inside Remix.

### Patch Changes

- Fix browser test runs so large suites can exceed the per-file timeout as long as individual test files keep reporting progress.

- Fix `describe.skip` and `describe.only` so they propagate to nested `describe` blocks. Previously the skipped/focused state was set only on the outer suite, so tests inside nested describes still ran (or were incorrectly skipped under `only`).

- Bumped `@remix-run/*` dependencies:
  - [`node-tsx@0.1.0`](https://github.com/remix-run/remix/releases/tag/node-tsx@0.1.0)

## v0.3.0

### Minor Changes

- Add `FakeTimers#advanceAsync(ms)` to `t.useFakeTimers()`. Like `advance`, it walks pending timers in time order and fires them, but yields to microtasks between each firing so promise continuations (and any timers they schedule) can settle before the next firing is processed. Use it when a fake-timer-driven callback awaits work that itself depends on the fake clock.

- Accept arrays for `glob.{test,browser,e2e,exclude}`, `project`, `type`, and `coverage.{include,exclude}` config fields
  - The matching CLI flags (`--glob.test`, `--project`, `--type`, etc.) can be repeated
  - Positional arguments after `remix-test` now collect into `glob.test`, so `remix-test "src/**/*.test.ts" "tests/**/*.test.tsx"` works.
  - `type`'s default is now `["server", "browser", "e2e"]` instead of `"server,browser,e2e"`.

- Include the total number of test files/suites in the end-of-run summary for all test reporters

### Patch Changes

- Load Playwright only when browser or E2E tests run, allowing test help and server-only test runs without Playwright installed. Browser and E2E test runs now report a clearer error when Playwright is missing.

- Run server and E2E test files in forked child processes by default, add `pool: 'threads'`/`--pool threads` to preserve the previous worker-thread behavior, and clean up leaked test worker resources after results are reported.

## v0.2.0

### Minor Changes

- Add `glob.exclude` config for filtering paths during test discovery (defaults to `node_modules/**`)

- Add code coverage reporting to `remix-test`
  - You can enable coverage with default settings vis `remix-test --coverage` or setting `coverage:true` in your `remix-test.config.ts`
  - Or you can specify individual coverage settings via the following config fields:
    - `coverage.dir`: Directory to store coverage information (default `.coverage`)
    - `coverage.include`: Array of globs for files to include in coverage
    - `coverage.exclude`: Array of globs for files to exclude from coverage
    - `coverage.statements`: Percentage threshold for statement coverage
    - `coverage.lines`: Percentage threshold for line coverage
    - `coverage.branches`: Percentage threshold for branch coverage
    - `coverage.functions`: Percentage threshold for function coverage

- Export `runRemixTest` from `@remix-run/test/cli` so other tools can run the Remix test runner programmatically without exiting the host process. The function returns an exit code so callers can decide how to terminate. The `remix-test` executable now declares Node.js 24.3.0 or later in package metadata.

### Patch Changes

- Internal refactor to test discovery to better support test execution in `bun`.
  - Unlike Node, Bun's `fs.promises.glob` _follows_ symbolic links and does not prune traversal via the `exclude` option, which can cause the test runner to enter `node_modules` symlink cycles in pnpm workspaces
  - Refactored the internal test discovery logic to detect and use Bun's native `Glob` class when running under the Bun runtime. Bun's `Glob#scan` does not follow symlinks by default, avoiding the cycle.
  - The Node runtime continues to use `fs.promises.glob`

- Use native dynamic `import()` in Bun to load `.ts` and `.tsx` files in the test runner

- Bumped `@remix-run/*` dependencies:
  - [`terminal@0.1.0`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.0)

## v0.1.0

### Minor Changes

- Initial release of `@remix-run/test`, a test framework for Remix applications.
  - `describe`/`it` test structure with `before`/`after`/`beforeEach`/`afterEach` hooks
  - `TestContext` (`t`) per test: `t.mock.fn()`, `t.mock.method()`, `t.after()` for cleanup
  - Playwright E2E testing via `t.serve()`
  - CLI (`remix-test`) with flags for all config options
  - Watch mode (`--watch`)
  - Config file support (`remix-test.config.ts`)
  - `globalSetup`/`globalTeardown` hooks via the `setup` module, called once before/after the entire test run

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`component@0.7.0`](https://github.com/remix-run/remix/releases/tag/component@0.7.0)
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## Unreleased
