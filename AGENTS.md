At a minimum, each package should include:

- `npm test` command for running the tests for just that package
- `npm build` for building output artifacts, including TypeScript definition files and both ESM and CJS builds
- `npm clean` for removing all build artifacts and resetting to a freshly checked out state

Write tests using the `node:test` library and write assertions using `node:assert/strict`.

Prefer using `let` instead of `const` for all local variables. Use `const` for module-scoped variables.
