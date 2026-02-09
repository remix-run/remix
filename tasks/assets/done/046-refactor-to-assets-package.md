## Refactor dev-assets-middleware core to @remix-run/assets package

**Context:** The unbundled production build needs the same transform + resolution logic as dev-assets-middleware. That logic lives in a central package usable in isolation—by dev-assets-middleware, by the build tool, and by anyone not using Remix.

### What was done

- New package `@remix-run/assets` in `packages/assets` with correct structure (exports, `src/index.ts` public API, logic in `src/lib`).
- Stateless core in assets (internal): transformFile, resolveSpecifiers, rewriteImports, extractImportSpecifiers, createDevPathResolver, path-resolver, resolve, rewrite, source-map, etag, module-graph. Build and dev handler use these under the hood.
- Stateful dev handler: createDevAssetsHandler(options) owning module graph and caches; serve(pathname, headers) → Response | null. Options: root, allow, deny, workspace, esbuildConfig.
- dev-assets-middleware is a thin adapter: creates handler and createDevAssets via @remix-run/assets, forwards GET/HEAD to handler.serve(), sets context.assets.
- **Minimal public API:** Only createDevAssetsHandler, createDevAssets, and types CreateDevAssetsHandlerOptions, DevAssetsWorkspaceOptions, DevAssetsEsbuildConfig. All other symbols are internal to the package.
- Source map fix: use esbuild sourcemap: true (separate map output) instead of 'inline' so we append one map and fix paths; avoid duplicate/empty source map comments.
- E2E and unit tests for handler behavior (transform, workspace, allow/deny, ETag, resolution, etc.) live in assets; dev-assets-middleware keeps middleware-specific tests and wiring smoke tests.
- All static checks pass (typecheck, lint, format:check) across the repo.
