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
