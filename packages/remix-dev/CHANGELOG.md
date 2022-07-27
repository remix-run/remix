# `@remix-run/dev`

## 1.6.6-next.0

### Patch Changes

- 916caa6a2: Write server build output files so that only assets imported from resource routes are written to disk
- 78a8dcc07: Add support for exporting links in `.mdx` files
- 20e2d6249: Ensure that build hashing is deterministic
- 3951fbf0d: Fix types for `@remix-run/dev/server-build` virtual module
  - @remix-run/serve@1.6.6-next.0
  - @remix-run/server-runtime@1.6.6-next.0

## 1.6.5

### Patch Changes

- Update `serverBareModulesPlugin` warning to use full import path ([#3656](https://github.com/remix-run/remix/pull/3656))
- Fix broken `--port` flag in `create-remix` ([#3694](https://github.com/remix-run/remix/pull/3694))
- Updated dependencies
  - `@remix-run/server-runtime`
  - `@remix-run/serve`
