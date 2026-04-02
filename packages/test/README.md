# testing

A test framework for Remix applications

## Features

- `describe`/`it` test structure with `before`/`after`/`beforeEach`/`afterEach` hooks
- Server-side unit testing
- Mock functions and spies via `t.mock` / `t.spyOn`
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
remix-test
```

By default, `remix-test` discovers all files matching `**/*.test.{ts,tsx}`. Pass a glob as the first positional argument to override:

```sh
remix-test "src/**/*.test.ts"
```

Or, you may control via the `glob.test` config field/CLI arg.

### Config File

Create a `remix-test.config.ts` (or `.js`) file at the root of your project (shown with default values):

```ts
import type { RemixTestConfig } from 'remix/test'

export default {
  // Max number of concurrent test workers (default `os.availableParallelism()`)
  concurrency: 2,

  glob: {
    // Test file glob pattern (default: "**/*.test.{ts,tsx}")
    test: '**/*.test.ts',
  },

  // Test reporter ("spec", "tap", "dot")
  reporter: 'spec',

  // Path to a setup module (see Setup section below)
  setup: './test/setup.ts',

  // Watch for file changes and re-run
  watch: false,
} satisfies RemixTestConfig
```

### CLI Options

You can point to a different config file location with the `--config` flag:

```sh
remix-test --config ./tests/config.ts
```

You may also specify any config field as a CLI flag which will take precedence over config file values:

| Flag                | Short |
| ------------------- | ----- |
| `--concurrency <n>` | `-c`  |
| `--glob.test`       |       |
| `--reporter <name>` | `-r`  |
| `--setup <path>`    |       |
| `--watch`           | `-w`  |

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

### Test Context

Each test callback receives a `TestContext` (`t`) as its first argument with helpful test utilities.

```ts
interface TestContext {
  // Register a cleanup function to run after the test completes
  after(fn: () => void): void

  // Create a mock function with an optional implementation
  mock<T extends (...args: any[]) => any>(impl?: T): MockFunction<T>

  // Spy on an object method with an optional implementation override
  spyOn<T extends object, K extends keyof T>(obj: T, method: K): MockFunction
}
```

#### Mocks and Spies

Use `t.mock()`/`t.spyOn()` to set up mocks and spies. This is preferred over the standalone `mock` import because TestContext mocks/spies wll be automatically cleaned up after the test runs.

```ts
it('mocks and spies', (t) => {
  // Create a mock function
  let fn = t.mock((x: number) => x * 2)
  fn(3)
  fn.mock.calls[0].result // 6

  // Spy on an existing method
  let spy = t.spyOn(console, 'warn')
  console.warn('test')
  spy.mock.calls.length // 1
  // both fn and spy are restored automatically when the test ends
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

### Standalone mocks (module scope)

When you need a mock outside of a test body, import `mock` directly and call `restore()` manually:

```ts
import { mock } from 'remix/test'

let spy = mock.spyOn(console, 'log')
// ...
spy.mock.restore?.()
```

### Assertions

`remix/test` re-exports `remix/assert`. See the [`@remix-run/assert` README](../assert/README.md) for full API documentation.

```ts
import * as assert from 'remix/assert'

assert.ok(value)
assert.equal(actual, expected)
assert.notEqual(actual, expected)
assert.deepEqual(actual, expected)
assert.notDeepEqual(actual, expected)
assert.match(string, regexp)
assert.throws(fn)
await assert.rejects(asyncFn)
assert.fail('message')
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
