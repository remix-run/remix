# In Progress Tasks

---

## Remove HMR from dev-assets-middleware to ship assets support

**Context:** HMR was expanded in a separate branch but is now on ice. To unblock and ship the assets support that this branch is about, we're removing all HMR from dev-assets-middleware and returning to a clean non-HMR state. We have a snapshot of the branch to reference (`markdalgleish/watch-hmr`) when we bring HMR back.

**Goal:** dev-assets-middleware provides on-demand transform + import rewriting + workspace serving only. No HMR code, options, or API surface. No dead code left behind.

### Implementation status

- [x] Remove HMR-specific files (hmr-sse, hmr-transform, hmr-transform.test, hmr-watcher, virtual/hmr-runtime, e2e/hmr.playwright)
- [x] Strip HMR from assets.ts: option, imports, watcher/SSE setup, HMR endpoints (/\_\_@remix/hmr-events, runtime module), HMR transform branch
- [x] Remove HMR-specific dead code from module graph: importers/importedModules, isComponent, changeTimestamp; invalidateModule, getModuleByFile; simplify rewriteImports (no graph edges, no changeTimestamp query param)
- [x] Remove leftover \_hmrEnabled parameter from transformSource and handleWorkspaceRequest
- [x] Remove dispose: dev-assets-middleware returns plain Middleware (no DevAssetsMiddleware type, no dispose); assets-middleware type no longer has dispose?: never
- [x] Update README and docs (remove HMR section, fix workspace code block)
- [x] Update tests: assets.test.ts virtual-module test (no HMR naming); module-graph.test.ts (remove invalidateModule/getModuleByFile tests, adjust ensureModuleNode assertions)
- [x] Remove HMR-only deps: chokidar, @swc/core, @swc/types from dev-assets-middleware package.json
- [x] Demo cleanup: bookstore and assets demos — remove dispose usage, remove hmr: true from devAssets config, simplify shutdown (no dispose call)
- [x] E2E sweep: e2e/dev-server.ts remove hmr: true and HMR comments; e2e/fixtures (index\*.html titles, utils.ts, Counter.tsx, Timer.tsx) — remove HMR from titles/comments

### Discovered requirements / decisions

- **lastModified** on ModuleNode stays: it’s for server-side transform cache invalidation (compare with file mtime on request), not HMR. **changeTimestamp** was the HMR-only piece (browser cache busting via ?t= in import URLs).
- Removing dispose is “weird API without HMR” — re-add when HMR returns. Demos that called dispose on shutdown no longer need it; shutdown is just server.close().

### Remaining

- None for this task. When ready to ship, move to done and add a brief “What was done” if needed.
- **Future (when HMR returns):** Re-add from snapshot: HMR files, hmr option, watcher/SSE, module graph edges + changeTimestamp + invalidateModule, dispose on middleware. No structural rework required.
