# Rename `/@workspace/` to `/__@workspace/`

### Context

The `/@workspace/` URL pattern is used for serving files outside the app root. Renaming it to `/__@workspace/` will help users visually filter it out better, as the double underscore prefix makes it more obviously an internal/special path.

### Implementation

- [x] Update URL pattern check in `devAssets()` middleware
- [x] Update URL generation in `resolvedPathToUrl()`
- [x] Update JSDoc comments and interface documentation
- [x] Update tests (all 74 tests passing)
- [x] Update plan.md documentation
- [x] Update README.md
- [x] Update any references in task files

### Summary

Successfully renamed the workspace URL pattern from `/@workspace/` to `/__@workspace/` to make it more visually distinct and easier to filter out. The double underscore prefix clearly marks it as an internal/special path.

All unit tests pass and the implementation is consistent across:

- Main implementation (`assets.ts`)
- Test suite (`assets.test.ts`)
- Documentation (README.md, plan.md)
- JSDoc comments and type definitions
