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
