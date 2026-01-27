### CJS detection and error

Detect CommonJS modules and return a helpful error.

**Acceptance Criteria:**

- [x] Detect CJS patterns (`module.exports`, `require()`)
- [x] Return 500 with clear error message explaining the package is CJS
- [x] Error message suggests solutions (pre-bundling when available, finding ESM alternative)
