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
