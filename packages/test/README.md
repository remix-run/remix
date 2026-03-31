# testing

A test framework for Remix applications

## Features

- `describe`/`it` test structure with `before`/`after`/`beforeEach`/`afterEach` hooks
- Mock functions and spies via `mock.fn` / `mock.spyOn`
- Coverage reporting
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

### CLI Options

| Flag                    | Short | Description                                         |
| ----------------------- | ----- | --------------------------------------------------- |
| `--watch`               | `-w`  | Watch for file changes and re-run                   |
| `--concurrency <n>`     | `-c`  | Max number of concurrent test workers               |
| `--coverage`            |       | Enable coverage reporting                           |
| `--coverage.dir <path>` |       | Coverage output directory (default: `.coverage`)    |
| `--coverage.include`    |       | Glob patterns to include in coverage (repeatable)   |
| `--coverage.exclude`    |       | Glob patterns to exclude from coverage (repeatable) |
| `--coverage.statements` |       | Minimum statement coverage threshold (%)            |
| `--coverage.lines`      |       | Minimum line coverage threshold (%)                 |
| `--coverage.branches`   |       | Minimum branch coverage threshold (%)               |
| `--coverage.functions`  |       | Minimum function coverage threshold (%)             |
| `--reporter <name>`     | `-r`  | Test reporter (default: `spec`)                     |
| `--setup <path>`        |       | Path to a setup module (see [Setup](#setup))        |
| `--config <path>`       |       | Path to a config file                               |

### Config File

Options can also be set in a `remix-test.config.ts` (or `.js`) file at the root of your project:

```ts
import type { RemixTestConfig } from 'remix/test'

export default {
  concurrency: 1,
  setup: './test/setup.ts',
  coverage: {
    dir: '.coverage',
    statements: 80,
    lines: 80,
  },
} satisfies RemixTestConfig
```

CLI flags take precedence over config file values.

### Setup

The `setup` option points to a module that can export `globalSetup` and/or `globalTeardown` functions, called once before and after the entire test run respectively:

```ts
// test/setup.ts
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
import { describe, it, suite, test } from 'remix/test'
import { before, after, beforeEach, afterEach } from 'remix/test'
```

`suite` and `test` are aliases for `describe` and `it`.

### Mocks

```ts
import { mock } from 'remix/test'

// Standalone mock function
let fn = mock.fn((x: number) => x * 2)
fn(3)
fn.mock.calls[0].result // 6

// Spy on an existing method
let spy = mock.spyOn(console, 'log')
console.log('hello')
spy.mock.calls.length // 1
spy.mock.restore?.()
```

Mocks and spies created via the `TestContext` (`t.mock` / `t.spyOn`) are automatically restored after each test:

```ts
it('auto-restored spy', (t) => {
  let spy = t.spyOn(console, 'warn')
  console.warn('test')
  assert.equal(spy.mock.calls.length, 1)
  // spy is restored automatically when the test ends
})
```

### Assertions

```ts
import * as assert from 'remix/assert'

assert.ok(value)
assert.equal(actual, expected)
assert.notEqual(actual, expected)
assert.deepEqual(actual, expected)
assert.notDeepEqual(actual, expected)
assert.match(string, regexp)
assert.doesNotMatch(string, regexp)
assert.throws(fn)
assert.doesNotThrow(fn)
await assert.rejects(asyncFn)
await assert.doesNotReject(asyncFn)
assert.fail('message')
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
