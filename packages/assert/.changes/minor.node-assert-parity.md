Align `@remix-run/assert` more closely with `node:assert/strict`.

The default export is now callable as an alias for `assert.ok`, matching Node's `assert(value)` usage. Assertion failures now expose Node-style `code` and `generatedMessage` fields, core assertion APIs throw custom `Error` message objects directly, and `throws`/`rejects`/`doesNotThrow`/`doesNotReject` now follow Node's expected-error and message argument behavior more closely.

Strict equality now uses `Object.is`, so `NaN` equals `NaN` and `0` does not equal `-0`. Deep equality now compares built-in objects such as `Date`, `RegExp`, `Error`, `Map`, `Set`, typed arrays, symbol properties, prototypes, and cyclic structures instead of only comparing enumerable string keys.

Added `assert.partialDeepEqual(actual, expected)`, a strict-by-default counterpart to Node's `assert.partialDeepStrictEqual` that passes when `actual` contains the partial deep structure in `expected`.

Tightened Node compatibility for assertion behavior, including generated-message metadata, expected-error argument validation, `Error` constructor and instance matching, partial array and byte-sequence matching, `URLSearchParams` comparisons, and invalid-argument handling for `match`/`doesNotMatch`.
