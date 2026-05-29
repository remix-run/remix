Improve Node compatibility for the `remix/assert` entrypoint.

The default export is now callable as an alias for `assert.ok`, failure errors expose Node-style metadata, expected-error/message handling more closely follows `node:assert/strict`, and strict/deep equality now handles `Object.is` and built-in object comparisons more consistently with Node.
