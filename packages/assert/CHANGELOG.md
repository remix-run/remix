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
