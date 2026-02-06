## Remove HMR from dev-assets-middleware to ship assets support

**Context:** HMR was expanded in a separate branch but is now on ice. To unblock and ship the assets support that this branch is about, we removed all HMR from dev-assets-middleware and returned to a clean non-HMR state. A snapshot of the branch (`markdalgleish/watch-hmr`) is available when we bring HMR back.

**Goal:** dev-assets-middleware provides on-demand transform + import rewriting + workspace serving only. No HMR code, options, or API surface. No dead code left behind.

### What was done

- Removed HMR-specific files: hmr-sse, hmr-transform, hmr-transform.test, hmr-watcher, virtual/hmr-runtime, e2e/hmr.playwright
- Stripped HMR from assets.ts: option, imports, watcher/SSE setup, HMR endpoints, HMR transform branch; removed leftover \_hmrEnabled parameter
- Simplified module graph: removed importers/importedModules, isComponent, changeTimestamp; invalidateModule, getModuleByFile; rewriteImports no longer builds graph edges or adds ?t= query params
- Removed dispose: dev-assets-middleware returns plain Middleware; assets-middleware type no longer has dispose
- Updated README, tests, demos (bookstore + assets), and E2E; removed HMR-only deps (chokidar, @swc/core, @swc/types)
- Fixed bookstore "Asset not found" for file:// URLs (normalizeEntryPath handles file:// so hydration roots resolve); added unit tests for file:// in assets.get()

**Decisions:** lastModified on ModuleNode kept for server-side transform cache invalidation. When HMR returns, re-add from snapshot: HMR files, hmr option, watcher/SSE, module graph edges + changeTimestamp + invalidateModule, dispose.
