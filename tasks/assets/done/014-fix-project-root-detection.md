### Fix projectRoot detection

Previous code assumed `root` was one level deep from project root, breaking nested paths.

**Acceptance Criteria:**

- [x] `projectRoot` found by walking up to find `node_modules/` directory
- [x] Works for `./app`, `./src/app`, `./packages/web/app`, etc.
- [x] Falls back to start directory if no `node_modules/` found
