# Combined: Module graph + HMR

These two tasks were implemented together since the module graph was primarily motivated by HMR needs.

## Module graph with transform caching

Track import relationships between modules for HMR and caching. Cache transform results to avoid re-running esbuild on unchanged files.

**Note:** This was unified with the HMR module graph. Implemented together.

**Acceptance Criteria:**

- [x] `ModuleNode` type with `url`, `file`, `importers`, `importedModules`, `transformResult`, `lastModified`
- [x] Graph is built incrementally as files are served
- [x] When a file is transformed, its imports are added to the graph
- [x] `getModuleByUrl(url)` and `getModuleByFile(file)` lookups
- [x] Transform results cached on module node, keyed by mtime
- [x] Skip `esbuild.build()` if mtime unchanged (cache hit)
- [x] `invalidateModule(mod)` clears cache and propagates to importers

**Implementation Details:**

- Added `ModuleNode` interface with bidirectional import/importer relationships
- Added `ModuleGraph` with URL and file path indexes for fast lookups
- Module graph is stored in per-instance `caches` object
- Graph built incrementally in `rewriteImports` - creates edges as imports are resolved
- Transform results include both code and source map, cached on the module node
- Cache key is file mtime (milliseconds) - checked before every transform
- On cache hit, returns cached code immediately without running esbuild
- `invalidateModule` recursively invalidates importers to handle transitive dependencies
- Handles circular dependencies with visited set to prevent infinite loops
- Placeholder nodes created for imports (URL only), filled in when file is requested
- All functions exported for testing, comprehensive unit tests added
- Integration test verifies caching works end-to-end with actual middleware

---

## Hot Module Replacement (HMR)

**Reference:** `markdalgleish/hmr-spike` branch (commit `95a6162c8`)

Integrate HMR into `dev-assets-middleware` rather than as a separate package. Both need the same knowledge (file structure, module graph, change detection), so splitting creates duplicate code and config.

**Prior art:** The HMR spike contains a working implementation with:

- `HMR-SPIKE.md` - Overview and implementation plan
- `packages/hmr-middleware/HMR-ARCHITECTURE.md` - Detailed architecture doc
- Working transforms, module graph, SSE, file watcher, and e2e tests

**Key approach (from spike):**

- **State hoisting** - SWC transforms hoist component state to a WeakMap so it survives module re-imports
- **Render proxy** - Components return a proxy that looks up the latest render function
- **Setup hash** - If setup code changes → remount (state lost); if only render changes → state preserved
- **Module graph** - Track imports to propagate changes to component boundaries
- **SSE** - Push updates to connected browsers

**Integration points:**

- Unified module graph (shared with transform caching)
- Shared file resolution and `workspace` config
- File watcher feeds both HMR updates and cache invalidation
- SWC transform added to pipeline after esbuild

**API:**

```typescript
devAssets('./app', {
  workspace: { ... },
  hmr: true,  // enabled by default? or opt-in?
})

devAssets('./app', { hmr: false })  // disable for debugging
```

**Acceptance Criteria:**

- [x] Port HMR spike code into dev-assets-middleware
  - [x] Add dependencies (@swc/core, @swc/types, chokidar, @remix-run/component)
  - [x] HMR runtime code generation (`hmr-runtime.ts`)
  - [x] SWC transform (`hmr-transform.ts`)
  - [x] SSE implementation (`hmr-sse.ts`)
  - [x] File watcher (`hmr-watcher.ts`)
  - [x] Add `requestRemount` API to component package
  - [x] Integrate into main middleware
    - [x] Add `hmr: boolean` option
    - [x] Wire SSE endpoint at `/__@remix/hmr`
    - [x] Serve runtime at `/__@remix/hmr/runtime.js`
    - [x] Run SWC transform after esbuild for components
    - [x] Wire file watcher to module graph + SSE
    - [x] Inject HMR script into HTML responses
  - [x] Port E2E tests from spike
    - [x] Test fixtures (Counter, Header, Footer, utils)
    - [x] Dev server helper
    - [x] HMR test suite (state preservation, remounting, propagation)

**Implementation Status:**

Core HMR infrastructure is complete and fully tested in dev-assets-middleware:

- **Module graph** - Tracks import relationships, component boundaries, change timestamps
- **Component boundaries** - Stops HMR propagation at component files (prevents unnecessary updates)
- **Cache busting** - Adds `?t=timestamp` query params to changed imports for browser cache invalidation
- **Transform pipeline** - esbuild → import rewriting (with timestamps) → SWC HMR transform
- **SSE endpoint** - `/__@remix/hmr` for pushing updates to connected browsers
- **Runtime module** - `/__@remix/hmr/runtime.js` served by middleware
- **File watcher** - Watches root directory, invalidates module graph, sends SSE updates
- **Opt-in** - Enabled via `hmr: true` option

**What's working:**

- Module graph building from imports ✅
- Transform caching with mtime checks ✅
- Component detection and SWC transform ✅
- Component boundary tracking (HMR stops at components) ✅
- Cache busting with timestamp query params ✅
- SSE connection and update broadcasting ✅
- File watching and change detection ✅
- Cache invalidation on file changes ✅
- State preservation on render changes ✅
- Remounting on setup changes ✅
- Change propagation through imports ✅
- Multiple rapid changes handling ✅
- Multi-component module updates ✅

**What needs testing:**

- [x] Run E2E tests with dev server - All 13 tests passing ✅
- [x] Demo app with `hmr: true` enabled (optional - E2E tests cover the same scenarios)

**Known limitations:**

- Component detection is heuristic-based (PascalCase function returning function)
- HTML injection requires downstream middleware to serve HTML (works for routes/static files)

**Recent fixes:**

- Fixed EMFILE error by using chokidar's `ignored` function with allow patterns
- Watcher now respects `allow` patterns, only watching relevant directories
- Correctly handles both path-based (`/^app\//`) and extension-based (`/\.tsx$/`) patterns
  - Uses `stats.isDirectory()` to allow directory traversal
  - Standard directories (node_modules, .git, dist, build) are always ignored first
  - Files are then filtered based on allow patterns
- Fast startup: < 20ms even in monorepo environments

---

## What was done

Implemented a complete HMR system integrated into the dev-assets-middleware:

1. **Module graph infrastructure** - Bidirectional import tracking, transform caching with mtime-based invalidation, placeholder nodes for unloaded modules

2. **HMR transform** - Ported complete SWC-based transform from spike that hoists component state to WeakMaps, wraps render functions in proxies, and tracks setup hash changes. Added comprehensive unit tests (24 tests) covering all component patterns.

3. **Runtime module** - Generated JavaScript served at `/__@remix/hmr/runtime.js` that manages state storage, component registry, SSE connection, and dynamic module updates

4. **File watcher** - Chokidar-based watcher with smart filtering using `allow` patterns, handles directory traversal correctly, fast startup (< 20ms)

5. **SSE infrastructure** - Server-sent events for pushing updates to browsers, handles connection management and broadcasting

6. **Component package integration** - Added `requestRemount` API to `@remix-run/component` for forcing re-initialization when setup scope changes

7. **E2E test suite** - Ported 13 comprehensive tests covering state preservation, remounting, propagation, rapid changes, and multi-component modules. All passing.

8. **Critical fixes during implementation:**
   - Added missing `requestRemount` API that was in spike but not initially ported
   - Fixed timestamp query params for cache busting (`?t=timestamp`)
   - Fixed component boundary tracking to stop propagation correctly
   - Fixed EMFILE error with smart directory filtering
   - Fixed HMR transform to correctly handle component props (added `renderParams` tracking)
   - Fixed function style preservation (arrow vs regular functions)
   - Ported all unit tests from spike (25 tests total)

The implementation successfully validates the feasibility of HMR for component-based frameworks and provides a solid foundation for future enhancements. It's expected that this implementation will be heavily improved upon.
