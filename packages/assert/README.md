# assert

A compatible subset of `node:assert/strict` that works in any JavaScript environment, including browsers — plus a vitest-/jest-style `expect` API for tests that prefer chainable matchers.

Uses strict equality (`===`) for all comparisons — no type coercion.

## Features

- `AssertionError` — compatible with `node:assert.AssertionError` (`actual`, `expected`, `operator`, `name`)
- `assert.ok` — truthy check
- `assert.equal` / `assert.notEqual` — strict equality (`===` / `!==`)
- `assert.deepEqual` / `assert.notDeepEqual` — recursive strict deep equality
- `assert.match` — string matches a regexp
- `assert.fail` — unconditional failure
- `assert.throws` — synchronous throw assertion
- `assert.rejects` — async rejection assertion
- `expect(value)` — chainable matchers with `.not`, `.rejects`, `.resolves`, plus `expect.objectContaining(...)` for partial matches

## Installation

```sh
npm i remix
```

## Usage

Mirrors `node:assert/strict` — uses strict equality (`===`), so `1 !== '1'` and `null !== undefined`.

```ts
import assert from 'remix/assert'

assert.ok(true)
assert.equal(1, 1)
assert.equal(1, '1') // throws — different types
assert.notEqual('a', 'b')
assert.deepEqual({ a: 1 }, { a: 1 })
assert.deepEqual({ a: 1 }, { a: '1' }) // throws — different types
assert.match('hello world', /world/)
assert.fail('should not reach here')

await assert.rejects(() => Promise.reject(new Error('oops')))
assert.throws(() => {
  throw new TypeError('bad')
}, TypeError)
```

### Named exports

Each assertion is also exported as a named function:

```ts
import {
  ok,
  assert, // alias of ok()
  equal,
  notEqual,
  deepEqual,
  notDeepEqual,
  match,
  fail,
  throws,
  rejects,
} from 'remix/assert'
```

### `expect`

A vitest-/jest-style chainable matcher API on top of the same `AssertionError`. Use `.not` to negate, `.rejects` / `.resolves` to assert on a promise. Mock-aware matchers work with `mock.fn()` / `mock.method()` from `@remix-run/test`.

```ts
import { expect } from 'remix/assert'

expect(value).toBe(42)
expect({ a: 1, b: 2 }).toEqual({ a: 1, b: 2 })
expect({ a: 1, b: 2 }).toEqual(expect.objectContaining({ a: 1 }))
expect({ a: { b: 1, c: 2 } }).toMatchObject({ a: { b: 1 } })
expect(value).not.toBeNull()
expect(arr).toHaveLength(3)
expect(spy).toHaveBeenCalledWith('hello', 1)

await expect(fetch('/missing')).rejects.toThrow('Not found')
await expect(loadModule()).resolves.toBeUndefined()
```

Available matchers:

| Group           | Matchers                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Equality        | `toBe`, `toEqual`, `toBeNull`, `toBeUndefined`, `toBeDefined`, `toBeTruthy`, `toBeInstanceOf`                            |
| Numbers         | `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeLessThanOrEqual`, `toBeCloseTo`                        |
| String/iterable | `toContain`, `toMatch`, `toHaveLength`                                                                                   |
| Object shape    | `toHaveProperty(path, value?)`, `toMatchObject(partial)`                                                                 |
| Throwing        | `toThrow(expected?)`                                                                                                     |
| Mock-aware      | `toHaveBeenCalled`, `toHaveBeenCalledTimes(n)`, `toHaveBeenCalledWith(...args)`, `toHaveBeenNthCalledWith(nth, ...args)` |

`expect.objectContaining(partial)` is an asymmetric matcher recognized by `toEqual` (and any matcher that uses deep equality under the hood). It passes when the actual value has at least the keys in `partial` with matching values — extra keys are allowed.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
