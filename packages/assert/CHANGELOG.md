## v0.3.0

### Minor Changes

- Align `@remix-run/assert` more closely with `node:assert/strict`.

  The default export is now callable as an alias for `assert.ok`, matching Node's `assert(value)` usage. Assertion failures now expose Node-style `code` and `generatedMessage` fields, core assertion APIs throw custom `Error` message objects directly, and `throws`/`rejects`/`doesNotThrow`/`doesNotReject` now follow Node's expected-error and message argument behavior more closely.

  Strict equality now uses `Object.is`, so `NaN` equals `NaN` and `0` does not equal `-0`. Deep equality now compares built-in objects such as `Date`, `RegExp`, `Error`, `Map`, `Set`, typed arrays, symbol properties, prototypes, and cyclic structures instead of only comparing enumerable string keys.

  Added `assert.partialDeepEqual(actual, expected)`, a strict-by-default counterpart to Node's `assert.partialDeepStrictEqual` that passes when `actual` contains the partial deep structure in `expected`.

  Tightened Node compatibility for assertion behavior, including generated-message metadata, expected-error argument validation, `Error` constructor and instance matching, partial array and byte-sequence matching, `URLSearchParams` comparisons, and invalid-argument handling for `match`/`doesNotMatch`.

## v0.2.1

### Patch Changes

- Add explicit public API types for the `expect` helper so generated declarations no longer depend on inference through assigned helper objects (see #11433).

## v0.2.0

### Minor Changes

- Add `expect` API alongside the existing `assert.*` functions

  - `expect(value).toBe(expected)`
    - `toBe`, `toEqual`, `toBeNull`, `toBeUndefined`, `toBeDefined`, `toBeTruthy`, `toBeInstanceOf`
    - Numbers: `toBeGreaterThan`, `toBeGreaterThanOrEqual`, `toBeLessThan`, `toBeLessThanOrEqual`, `toBeCloseTo`
    - Strings / iterables: `toContain`, `toMatch`, `toHaveLength`
    - Object shape: `toHaveProperty`, (recursive partial equality)
    - Throwing: `toThrow`
    - Mock-aware (works with `mock.fn()` / `mock.method()` from `@remix-run/test`): `toHaveBeenCalled`, `toHaveBeenCalledTimes`, `toHaveBeenCalledWith`, `toHaveBeenNthCalledWith`
    - Partial matching: `expect(value).toMatchObject(expected)`, `expect(value).toEqual(expect.objectContaining(expected))`

### Patch Changes

- Add missed object support to `assert.throws` and `assert.rejects` for validating individual error properties (e.g. `{ code: 'ERR_INVALID_ARG_VALUE' }`). `RegExp` values inside the object match string properties; everything else uses deep equality.

## v0.1.0

### Minor Changes

- Initial release of `@remix-run/assert`.

  A compatible subset of `node:assert/strict` that works in any JavaScript environment, including browsers. Uses strict equality (`===`) for all comparisons — no type coercion.

  - `AssertionError` — compatible with `node:assert.AssertionError` (`actual`, `expected`, `operator`, `name`)
  - `assert.ok` — truthy check
  - `assert.equal` / `assert.notEqual` — strict equality (`===` / `!==`)
  - `assert.deepEqual` / `assert.notDeepEqual` — recursive strict deep equality
  - `assert.match` — string matches a regexp
  - `assert.fail` — unconditional failure
  - `assert.throws` — synchronous throw assertion
  - `assert.rejects` — async rejection assertion

## Unreleased
