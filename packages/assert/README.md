# assert

A compatible subset of `node:assert/strict` that works in any JavaScript environment, including browsers.

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

## Installation

```sh
npm i remix
```

## Usage

Mirrors `node:assert/strict` — uses strict equality (`===`), so `1 !== '1'` and `null !== undefined`.

```ts
import { assert } from 'remix/assert'

assert.ok(true)
assert.equal(1, 1)
assert.equal(1, '1')           // throws — different types
assert.notEqual('a', 'b')
assert.deepEqual({ a: 1 }, { a: 1 })
assert.deepEqual({ a: 1 }, { a: '1' })  // throws — different types
assert.match('hello world', /world/)
assert.fail('should not reach here')

await assert.rejects(() => Promise.reject(new Error('oops')))
assert.throws(() => { throw new TypeError('bad') }, TypeError)
```

### Named exports

Each assertion is also exported as a named function:

```ts
import { ok, equal, notEqual, deepEqual, notDeepEqual, match, fail, throws, rejects } from 'remix/assert'
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
