# `test`

A test framework for JavaScript and TypeScript projects.

## Features

- `describe`/`it` test structure with `before`/`after`/`beforeEach`/`afterEach` hooks
- Server-side unit testing
- Playwright E2E testing via `t.serve`
- In-browser component testing (pair with `render` from `remix/ui/test`)
- Mock functions and method spies via `t.mock.fn` / `t.mock.method`
- Unified code coverage reporting across unit and E2E tests
- Watch mode
- Config file support (`remix-test.config.ts`)

## Installation

```sh
npm i remix
```

## Usage

Write test files that import from `remix/test`:

```ts
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

describe('My Test Suite', () => {
  it('tests a function', () => {
    let result = something()
    assert.equal(result, 42)
  })
})
```

Run tests with the CLI:

```sh
remix test
```

By default, `remix test` discovers all files matching `**/*.test{,.e2e}.{ts,tsx}`. Pass a glob as the first positional argument to override:

```sh
remix test "src/**/*.test.ts"
```

Or, you may control via the `glob.test` config field/CLI arg.

If you install `@remix-run/test` directly instead of the umbrella `remix` package, the same runner is available as `remix-test`:

```sh
npm i @remix-run/test
remix-test
```

### Config File

Create a `remix-test.config.ts` (or `.js`) file at the root of your project (shown with default values):

```ts
import type { RemixTestConfig } from 'remix/test'

export default {
  // Browser options for E2E tests
  browser: {
    // Echo browser console output to the terminal
    echo: false,
    // Open browser (via playwright `headless:false`) and keep it open after tests
    // complete (useful for debugging)
    open: false,
  },

  // Max number of concurrent test workers (default `os.availableParallelism()`)
  concurrency: 2,

  // Code coverage options
  coverage: {
    // Enable coverage reporting
    enabled: true,
    // Output directory (default: ".coverage")
    dir: '.coverage',
    // Glob patterns to include/exclude
    include: ['src/**'],
    exclude: ['src/**/*.test.ts'],
    // Minimum thresholds (%)
    statements: 80,
    lines: 80,
    branches: 80,
    functions: 80,
  },

  glob: {
    // Glob pattern identifying all test files (default: "**/*.test{,.browser,.e2e}.{ts,tsx}")
    test: '**/*.test{,.browser,.e2e}.ts',
    // Glob pattern identifying browser test files (default: "**/*.test.browser.{ts,tsx}")
    browser: '**/*.test.browser.ts',
    // Glob pattern identifying E2E test files (default: "**/*.test.e2e.{ts,tsx}")
    e2e: '**/*.test.e2e.ts',
  },

  // Playwright configuration for E2E tests, or string path to an existing
  // config file on disk
  playwrightConfig: {
    projects: [
      { name: 'chromium', use: { browserName: 'chromium' } },
      { name: 'firefox', use: { browserName: 'firefox' } },
    ],
    use: {
      navigationTimeout: 5_000,
      actionTimeout: 5_000,
    },
  },

  // Worker pool implementation: "forks" (default, runs each test file in a
  // `child_process.fork` subprocess for full process-level isolation) or
  // "threads" (runs each test file in a `worker_threads.Worker`, which has
  // lower per-file startup overhead but shares the host process)
  pool: 'forks',

  // Comma-separated list of playwright projects to run E2E tests for
  project: 'chromium',

  // Test reporter ("spec", "files", "tap", "dot")
  reporter: 'spec',

  // Path to a setup module (see Setup section below)
  setup: './test/setup.ts',

  // Comma-separated list of test types to run ("server", "browser", "e2e")
  type: 'server,browser,e2e',

  // Watch for file changes and re-run
  watch: false,
} satisfies RemixTestConfig
```

### CLI Options

You can point to a different config file location with the `--config` flag:

```sh
remix test --config ./tests/config.ts
```

You may also specify any config field as a CLI flag which will take precedence over config file values:

| Flag                        | Short |
| --------------------------- | ----- |
| `--browser.echo`            |       |
| `--browser.open`            |       |
| `--concurrency <n>`         | `-c`  |
| `--coverage`                |       |
| `--coverage.dir <path>`     |       |
| `--coverage.include`        |       |
| `--coverage.exclude`        |       |
| `--coverage.statements`     |       |
| `--coverage.lines`          |       |
| `--coverage.branches`       |       |
| `--coverage.functions`      |       |
| `--glob.test`               |       |
| `--glob.browser`            |       |
| `--glob.e2e`                |       |
| `--playwrightConfig <path>` |       |
| `--pool <name>`             |       |
| `--project <name>`          | `-p`  |
| `--reporter <name>`         | `-r`  |
| `--setup <path>`            | `-s`  |
| `--type <name>`             | `-t`  |
| `--watch`                   | `-w`  |

### Setup

The `setup` option points to a module that can export `globalSetup` and/or `globalTeardown` functions, called once before and after the entire test run respectively:

```ts
// ./test/setup.ts
export async function globalSetup() {
  await db.migrate()
}

export async function globalTeardown() {
  await db.close()
}
```

## API

### Test framework

```ts
import { beforeAll, afterAll, beforeEach, afterEach, describe, it } from 'remix/test'

beforeAll(() => {})
afterAll(() => {})

describe('My Test Suite', () => {
  beforeEach(() => {})
  afterEach(() => {})

  it('tests something', () => {})
  it('tests something else', () => {})
})
```

`suite` and `test` are aliases for `describe` and `it`.

```ts
import { suite, test } from 'remix/test'

suite('My Test Suite', () => {
  test('tests something', () => {})
})
```

### Programmatic runner

`@remix-run/test/cli` exports `runRemixTest()` for tools that want to run the test runner without
exiting the current process:

```ts
import { runRemixTest } from '@remix-run/test/cli'

let exitCode = await runRemixTest({
  argv: ['--type', 'server'],
  cwd: process.cwd(),
})
```

`runRemixTest()` returns the runner exit code. The `remix test` and `remix-test` bin wrappers call
`process.exit()` with that code when the run finishes so open workers, browsers, or project handles
cannot keep the CLI alive.

### Test Context

Each test callback receives a `TestContext` (`t`) as its first argument with helpful test utilities.

```ts
// from 'remix/test'
interface TestContext {
  // Register a cleanup function to run after the test completes
  after(fn: () => void): void

  // Mock tracker, mirroring the shape of Node's `t.mock` from `node:test`
  mock: {
    // Create a mock function with an optional implementation
    fn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T>

    // Mock an object method with an optional implementation override
    method<T extends object, K extends keyof T>(
      obj: T,
      methodName: K,
      impl?: Function,
    ): MockFunction
  }

  // Replace global timer functions with controllable fakes
  useFakeTimers(): FakeTimers

  // E2E only: connect a running test server to a Playwright Page
  serve(server: { baseUrl: string; close(): Promise<void> }): Promise<Page>
}
```

#### Mocks and Spies

Use `t.mock.fn()`/`t.mock.method()` to set up mocks and method spies. This is preferred over the standalone `mock` import because TestContext method mocks are automatically restored after the test runs.

```ts
it('mocks and spies', (t) => {
  // Create a mock function
  let fn = t.mock.fn((x: number) => x * 2)
  fn(3)
  fn.mock.calls[0].result // 6

  // Mock an existing method
  let spy = t.mock.method(console, 'warn')
  console.warn('test')
  spy.mock.calls.length // 1
  // spy is restored automatically when the test ends
})
```

#### Cleanup

You can register local test cleanup logic with `t.after()`:

```ts
it('cleanup', (t) => {
  let conn = db.connect()
  t.after(() => conn.close())
  // ...
})
```

#### Fake Timers

`t.useFakeTimers()` replaces the global timer functions (`setTimeout`, `setInterval`, etc.) with controllable fakes that are automatically restored after the test. It works in any test environment — server unit tests, browser tests, or E2E setup code.

```ts
it('debounces a callback', (t) => {
  let timers = t.useFakeTimers()
  let calls = 0
  let debounced = debounce(() => calls++, 300)

  debounced()
  timers.advance(299)
  assert.equal(calls, 0)
  timers.advance(1)
  assert.equal(calls, 1)
})
```

| Method        | Description                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `advance(ms)` | Advance the clock by `ms` milliseconds, firing any elapsed timers           |
| `restore()`   | Restore the original timer functions (called automatically after each test) |

#### E2E

In E2E test files, `t.serve()` connects a running test server to a Playwright `Page`. See [E2E Testing](#e2e-testing) for details.

```ts
import { createTestServer } from 'remix/node-fetch-server/test'

it('navigates to home', async (t) => {
  let router = createRouter()
  let server = await createTestServer(router.fetch)
  let page = await t.serve(server)
  await page.goto('/')
})
```

### Standalone mocks (module scope)

When you need a mock outside of a test body, import `mock` directly and call `restore()` manually:

```ts
import { mock } from 'remix/test'

let spy = mock.method(console, 'log')
// ...
spy.mock.restore?.()
```

### Browser Testing

Browser tests run components in an actual browser environment via Playwright and are discovered by the `**/*.test.browser.{ts,tsx}` glob pattern (configurable via `glob.browser`). They use the same `describe`/`it` API as unit tests. Each in-browser test suite runs in an isolated `iframe` so it has access to its own `document` instance.

#### `render()`

`render`, exported from `remix/ui/test`, mounts a component into the DOM and returns a `RenderResult`:

```ts
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { render } from 'remix/ui/test'
import { Counter } from './counter.tsx'

describe('Counter', () => {
  it('increments on click', async (t) => {
    let { $, act, cleanup } = render(<Counter />)
    t.after(cleanup)

    assert.equal($('[data-count]')?.textContent, '0')
    await act(() => $('[data-action="increment"]')?.click())
    assert.equal($('[data-count]')?.textContent, '1')
  })
})
```

`RenderResult` provides:

| Property/Method | Description                                                             |
| --------------- | ----------------------------------------------------------------------- |
| `container`     | The `HTMLElement` the component is mounted into                         |
| `root`          | The Remix `VirtualRoot` the component is rendered in                    |
| `$(selector)`   | Alias for `container.querySelector()`                                   |
| `$$(selector)`  | Alias for `container.querySelectorAll()`                                |
| `act(fn)`       | Runs `fn` and flushes pending component updates                         |
| `cleanup()`     | Unmounts and removes the container (pass to `t.after` for auto-cleanup) |

### E2E Testing

End-to-end (E2E) tests use [Playwright](https://playwright.dev) and are discovered by the `**/*.test.e2e.{ts,tsx}` glob pattern (configurable via `glob.e2e`). They use the same `describe`/`it` API as unit tests.

E2E tests receive `t.serve()` on the test context, which accepts a running test server and returns a Playwright [`Page`](https://playwright.dev/docs/api/class-page) whose `baseURL` points at that server. The server and page are automatically closed after each test.

```ts
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import { createRouter } from './router.ts'

describe('checkout', () => {
  it('adds an item to the cart', async (t) => {
    let router = createRouter()
    let server = await createTestServer(router.fetch)
    let page = await t.serve(server)

    await page.goto('/')
    await page.getByRole('button', { name: 'Add to Cart' }).click()
    await page.getByRole('link', { name: 'Cart' }).click()
    await page.getByRole('heading', { name: 'Shopping Cart' }).waitFor()

    assert.equal(await page.locator('[data-test-cart-quantity]').innerText(), 1)
  })
})
```

Configure Playwright (browsers, timeouts, viewport, etc.) via `playwrightConfig` in your config file:

```ts
export default {
  playwrightConfig: {
    projects: [
      { name: 'chromium', use: { browserName: 'chromium' } },
      { name: 'firefox', use: { browserName: 'firefox' } },
      { name: 'webkit', use: { browserName: 'webkit' } },
    ],
    use: {
      navigationTimeout: 5_000,
      actionTimeout: 5_000,
    },
  },

  // Or, point to an existing playwright config file
  // playwrightConfig: './playwright.config.ts'
} satisfies RemixTestConfig
```

Set `browser.open: true` to keep the browser open after tests finish — useful for debugging failures.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
