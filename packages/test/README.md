# test

A test framework for JavaScript and TypeScript projects.

## Features

- `describe`/`it` test structure with `before`/`after`/`beforeEach`/`afterEach` hooks
- Server-side unit testing
- Playwright E2E testing via `t.serve`
- In-browser component testing (pair with `render` from `remix/ui/test`)
- Mock functions and method spies via `t.mock.fn` / `t.mock.method`
- Per-test and hook timeouts with `t.signal` abort support
- Unified code coverage reporting across unit and E2E tests
- Watch mode
- Static CLI configuration through `remix.json`

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

By default, `remix test` discovers all files matching `**/*.test{,.browser,.e2e}.{ts,tsx}`. Pass one or more globs as positional arguments to override:

```sh
remix test "src/**/*.test.ts"
remix test "src/**/*.test.ts" "tests/**/*.test.tsx"
```

You may also repeat the `--glob.*` flags. Positional globs take precedence over `--glob.test`.

### Config File

Create an optional `remix.json` at the root of your project. It is parsed as JSONC, so comments and
trailing commas are allowed:

```jsonc
{
  "$schema": "https://remix.run/schemas/remix.json",
  "test": {
    "files": ["**/*.test{,.browser,.e2e}.{ts,tsx}"],
    "browserFiles": ["**/*.test.browser.{ts,tsx}"],
    "e2eFiles": ["**/*.test.e2e.{ts,tsx}"],
    "exclude": ["node_modules/**", "dist/**"],
    "type": ["server", "browser", "e2e"],
    "only": ["/checkout/i"],

    "concurrency": 2,
    "pool": "forks",
    "setup": "./test/setup.ts",
    "watch": false,

    "playwright": {
      "echo": false,
      "open": false,
      "configFile": "./playwright.config.ts",
      "projects": ["chromium", "firefox"],
    },

    "reporter": "spec",
    "quiet": false,

    "coverage": {
      "enabled": true,
      "dir": ".coverage",
      "include": ["src/**"],
      "exclude": ["src/**/*.test.ts"],
      "statements": 80,
      "lines": 80,
      "branches": 80,
      "functions": 80,
    },
  },
}
```

Every field is optional. Relative paths and globs resolve from the directory containing the config
file. Explicit CLI flags and positional globs take precedence. Repeatable flags replace configured
arrays, and nested Playwright and coverage values merge by field.

`remix-test.config.ts` and `remix-test.config.js` are no longer discovered. Move their static values
under `remix.json#test`. Move inline Playwright configuration into `playwright.config.ts` and point
`playwright.configFile` at it. Use slash-delimited strings for regular expressions, and use CLI flags
or package scripts for environment-specific overrides.

### CLI Options

Use the global `--config` flag to select another Remix config file. The flag path resolves from the
current working directory:

```sh
remix test --config ./config/remix.ci.json
```

You may specify any test setting as a CLI flag. Boolean settings have negative forms so configured
`true` values can be disabled explicitly:

| Flag                        | Short |
| --------------------------- | ----- |
| `--browser.echo`            |       |
| `--no-browser.echo`         |       |
| `--browser.open`            |       |
| `--no-browser.open`         |       |
| `--concurrency <n>`         | `-c`  |
| `--coverage`                |       |
| `--no-coverage`             |       |
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
| `--glob.exclude`            |       |
| `--playwrightConfig <path>` |       |
| `--only <pattern>`          |       |
| `--pool <forks\|threads>`   |       |
| `--project <name>`          | `-p`  |
| `--quiet`                   | `-q`  |
| `--no-quiet`                |       |
| `--reporter <name>`         | `-r`  |
| `--setup <path>`            | `-s`  |
| `--type <name>`             | `-t`  |
| `--watch`                   | `-w`  |
| `--no-watch`                |       |

The standalone `remix-test` executable is no longer installed. Update scripts to use the main Remix CLI:

```diff
- "test": "remix-test --type server"
+ "test": "remix test --type server"
```

### Focusing Tests

Use `.only` to focus a suite or test while developing:

```ts
describe.only('Cart routes', () => {
  it('loads cart items', () => {})
})

describe('Checkout routes', () => {
  it.only('redirects anonymous users', () => {})
})
```

Use `--only <pattern>` to focus tests from the CLI without editing source. Plain patterns are case-insensitive JavaScript regular expressions matched against suite names and full test names:

```sh
remix test --only 'Cart routes'
remix test --only 'Checkout routes > redirects anonymous users'
remix test --only '/anonymous users$/'
```

Slash-delimited CLI and `remix.json` patterns preserve their flags, so `/pattern/` is case-sensitive and `/pattern/i` is case-insensitive. Plain string patterns are case-insensitive. Programmatic callers may also pass `RegExp` values.

Full test names join nested `describe` names and the test name with `>`. For example, `describe('Cart routes', () => describe('loader', () => it('loads cart items', ...)))` has the full test name `Cart routes > loader > loads cart items`.

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
  it('skips with a reason', { skip: 'requires API credentials' }, () => {})
  it('tracks planned work', { todo: 'add retry coverage' }, () => {})
  it('fails if it takes too long', { timeout: 5_000 }, async (t) => {
    await fetchSomething({ signal: t.signal })
  })
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

`remix/test/cli` exports `runRemixTest()` for tools that want to run the test runner without exiting the current process:

```ts
import { runRemixTest } from 'remix/test/cli'

let exitCode = await runRemixTest({
  concurrency: 1,
  cwd: process.cwd(),
  glob: { test: 'src/**/*.test.ts' },
  type: ['server'],
})
```

The programmatic runner accepts structured options only; it does not discover or load configuration
files. Programmatic callers may pass richer values such as an inline Playwright config or `RegExp`
test-name filters. The main Remix CLI owns `remix.json` loading and passes the resolved options to the
runner.

`runRemixTest()` does not read `process.argv` or terminate the process; it returns the runner exit code. The main `remix` executable owns argument parsing and passes the final code to `process.exit()` so open workers, browsers, or project handles cannot keep the CLI alive. `@remix-run/test` does not install a standalone executable.

### Test Context

Each test callback receives a `TestContext` (`t`) as its first argument with helpful test utilities.

```ts
// from 'remix/test'
interface TestContext {
  // Aborts when the test times out or when the user-provided test signal aborts
  signal: AbortSignal

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

#### Timeouts and Signals

Pass `{ timeout: ms }` to `it()` or after any lifecycle hook callback to fail that work if it takes too long. Timed-out tests abort `t.signal`, so async code that accepts an `AbortSignal` can cancel promptly.

```ts
it('loads data', { timeout: 5_000 }, async (t) => {
  let response = await fetch('/api/data', { signal: t.signal })
  assert.equal(response.status, 200)
})

beforeEach(
  async () => {
    await resetDatabase()
  },
  { timeout: 1_000 },
)
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

Configure Playwright's browsers, timeouts, viewport, and other executable settings in
`playwright.config.ts`:

```ts
import { defineConfig } from 'playwright/test'

export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  use: {
    navigationTimeout: 5_000,
    actionTimeout: 5_000,
  },
})
```

Reference it from `remix.json` when it is not at the default location:

```jsonc
{
  "test": {
    "playwright": {
      "configFile": "./playwright.config.ts",
    },
  },
}
```

Set `test.playwright.open` to `true`, or pass `--browser.open`, to keep the browser open after tests
finish—useful for debugging failures.

## Related Packages

- [`assert`](https://github.com/remix-run/remix/tree/main/packages/assert) provides assertions that work in server and browser tests.
- [`ui`](https://github.com/remix-run/remix/tree/main/packages/ui) provides the `remix/ui/test` browser rendering utilities.

## Related Work

- [Playwright](https://playwright.dev) provides the browser automation used by browser and E2E tests.
- [Node.js test runner](https://nodejs.org/api/test.html) provides prior art for the test framework API and reporting model.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
