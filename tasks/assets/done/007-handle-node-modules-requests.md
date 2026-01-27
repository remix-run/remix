### Handle `/@node_modules/` requests

Serve files from `node_modules/` when `/@node_modules/...` URLs are requested.

**Acceptance Criteria:**

- [x] `/@node_modules/@remix-run/component/src/index.ts` serves from node_modules
- [x] Symlinks are followed automatically (workspace packages work)
- [x] Files are transformed (imports rewritten)
- [x] Returns 404 for files that don't exist
- [x] Only serves transformable extensions
