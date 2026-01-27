# Assets Middleware - TODO

NOTE: Tasks that are in progress should be moved to `in-progress.md`.

## Features

### HMR refactor and cleanup

Simplify the HMR and module graph implementation by removing unused features, improving code organization, and cleaning up data structures. Focus on "beautifully simple" - only what we need, no more.

**Philosophy:** Don't build for future features. Add complexity only when actually needed with evidence it provides value. Code should be easy to follow.

**Incremental approach:** Complete each step fully and verify before moving to the next. Each step should leave the codebase in a working, tested state.

---

**Step 1: Remove bidirectional module graph (`importedModules`)**

Currently tracking both `importers` (who imports me) and `importedModules` (who I import). The downward links (`importedModules`) aren't actually traversed - they're only used to maintain graph structure. Pre-emptive transforms aren't implemented yet.

**Goal:** Remove `importedModules` entirely. Just track `importers` (upward links). Add downward links later when we actually implement a feature that needs them.

**Acceptance Criteria:**
- [ ] Remove `importedModules` from `ModuleNode` interface
- [ ] Remove code that maintains `importedModules` relationships in `rewriteImports`
- [ ] HMR still works (importers are sufficient for cache invalidation)
- [ ] All existing unit tests pass
- [ ] All existing E2E tests pass (HMR functionality unchanged)
- [ ] Code is simpler (fewer Set operations, clearer intent)

**Verification checkpoint:** Confirm this step is complete and working before proceeding to Step 2.

---

**Step 2: Verify transform caching is elegant (audit only)**

Transform caching is **critical** (compiling node_modules on the fly without caching would be too slow). This step is just an audit to ensure the current implementation is clean and not introducing unnecessary complexity.

**Current approach:**
- Cache lives on `ModuleNode.transformResult` 
- Cache key is `lastModified` (file mtime)
- Cache hit: return stored code, skip esbuild
- Cache miss: run esbuild, store result + mtime

**Goal:** Verify current implementation is elegant enough. Don't change unless there's a clear improvement.

**Acceptance Criteria:**
- [ ] Review transform caching code in `assets.ts`
- [ ] Verify cache logic is centralized and easy to follow
- [ ] Verify mtime-based invalidation is reliable
- [ ] Document any concerns or potential improvements for future
- [ ] **Decision:** Keep as-is OR make specific targeted improvements (document why)

**Verification checkpoint:** Confirm audit is complete and any changes (if made) are tested before proceeding to Step 3.

---

**Step 3: Split `assets.ts` into focused modules**

`assets.ts` is 1,431 lines and does too much: module graph, transform caching, import rewriting, HMR integration, workspace resolution, ETag generation, and middleware orchestration.

**Goal:** Extract into clearer boundaries while keeping the total number of files manageable.

**Proposed structure:**
- `module-graph.ts`: `ModuleNode`, `ModuleGraph`, operations (`createModuleNode`, `invalidateModule`, `getModuleByUrl`, `getModuleByFile`)
- `import-rewriter.ts`: Import parsing (`extractImportSpecifiers`), resolution, `rewriteImports()` with MagicString
- `assets.ts`: HTTP handling, middleware orchestration, calls into graph + rewriter

**Acceptance Criteria:**
- [ ] Create `src/lib/module-graph.ts` with graph data structure and operations
- [ ] Create `src/lib/import-rewriter.ts` with import parsing and rewriting logic
- [ ] Update `assets.ts` to import and use these modules
- [ ] **CRITICAL:** Move tests to dedicated test files for new modules:
  - [ ] Create `src/lib/module-graph.test.ts` for module graph tests
  - [ ] Create `src/lib/import-rewriter.test.ts` for import rewriting tests
  - [ ] Move relevant tests from `assets.test.ts` to appropriate new test files
  - [ ] Keep only assets-specific/integration tests in `assets.test.ts`
- [ ] **CRITICAL:** Verify no tests were lost in the refactor:
  - [ ] Count total assertions/test cases before refactor
  - [ ] Count total assertions/test cases after refactor
  - [ ] Numbers must match (or increase if new tests added)
  - [ ] Review git diff to ensure all test logic was moved, not deleted
- [ ] All existing unit tests pass
- [ ] All existing E2E tests pass
- [ ] Main middleware file (`assets.ts`) is significantly smaller and easier to follow
- [ ] Each file has a clear, single responsibility

**Verification checkpoint:** Confirm split is complete, tests pass, and code is clearer before proceeding to Step 4.

---

**Step 4: Simplify HMR runtime registries (3 → 2)**

Currently using three separate data structures in the HMR runtime to track components and handles. Can simplify to two with better semantics.

**Current (3 structures):**
```javascript
const renderRegistry = new WeakMap()        // handle → renderFn
const handlesByModule = new Map()            // url → name → Set<handle>
const componentRegistry = new Map()          // "url::name" → componentFn
```

**Proposed (2 structures, no string concatenation keys):**
```javascript
// Nested map: semantic structure organized by URL, then name
const components = new Map() // url → Map<name, { impl, handles: Set }>

// Fast lookup from handle
const handleToComponent = new WeakMap() // handle → { url, name, renderFn }
```

**Benefits:**
- No string concatenation keys (`url + '::' + name`)
- Semantic structure (components organized by URL, then name)
- Easier to iterate over all components in a module (for HMR updates)
- One less data structure

**Acceptance Criteria:**
- [ ] Update `hmr-runtime.ts` to use new two-structure approach
- [ ] Update `__hmr_register` to use nested Map
- [ ] Update `__hmr_call` to use WeakMap lookup
- [ ] Update `__hmr_get_component` to use nested Map
- [ ] Update `__hmr_register_component` to use nested Map
- [ ] Update `performUpdate` to iterate nested Map (simpler than before)
- [ ] All existing E2E tests pass (HMR functionality unchanged)
- [ ] Code is clearer (no string key construction, semantic structure obvious)

**Verification checkpoint:** Confirm registry refactor is complete and HMR works correctly. Task complete!

---

### Refactor HMR runtime to real TypeScript module

Convert the HMR runtime from a generated string to a real TypeScript module that goes through the standard transform pipeline. This eliminates globals, enables direct imports, and simplifies the architecture.

**Current problems:**

- HMR runtime is generated as a string (poor authoring experience)
- Uses `window.__hmr_request_remount_impl` global to bridge to `@remix-run/component`
- HTML injection required to bootstrap SSE connection
- Entry points must wire up the global connection
- No TypeScript type checking or source maps for the runtime itself

**Target architecture:**

The HMR runtime should be a real `.ts` file that:
- Imports `requestRemount` directly from `@remix-run/component` (no globals)
- Gets transformed by the same pipeline as user code (import rewriting works automatically)
- Establishes SSE connection as a side effect when first imported
- No HTML injection needed - connection bootstraps naturally via ESM imports

**Mental model:** "There's an HMR module at `/__@remix/hmr/runtime.js` that works like any module you could have written yourself."

**Incremental implementation steps:**

Each step is independently shippable with all tests passing:

**Step 1: Convert to real TypeScript module (infrastructure)**
- Create `src/lib/hmr-runtime.module.ts` with current string content
- Update `assets.ts` to load and transform this file instead of generating string
- Keep all existing behavior (globals, HTML injection)
- Checkpoint: Better authoring, same behavior

**Step 2: Add direct import (dual mode)**
- Add `import { requestRemount } from '@remix-run/component'` to runtime
- Runtime calls imported `requestRemount` directly
- Entry points still set global (becomes dead code)
- Checkpoint: Runtime is self-sufficient, no breaking changes

**Step 3: Remove global from entry points**
- Remove `window.__hmr_request_remount_impl = requestRemount` from entries
- Remove global references from runtime
- Checkpoint: No more globals, pure ESM

**Step 4: Remove HTML injection**
- Remove HTML injection logic (SSE bootstraps via module import)
- Checkpoint: Pure module graph, no special handling

**Step 5: Cleanup**
- Delete `generateRuntimeModule()` function and any dead code

**Acceptance Criteria:**

**Step 1:**
- [ ] Create `src/lib/hmr-runtime.module.ts` with current runtime logic
- [ ] Update `assets.ts` to serve runtime via `transformSource()` instead of raw string
- [ ] Runtime gets source maps (verify with `parseInlineSourceMap()`)
- [ ] All existing E2E tests pass unchanged
- [ ] All existing unit tests pass unchanged

**Step 2:**
- [ ] Runtime imports `requestRemount` from `@remix-run/component`
- [ ] Import path gets correctly rewritten to `/__@workspace/...`
- [ ] Runtime calls imported function instead of global
- [ ] Entry points still set global (unused but harmless)
- [ ] All E2E and unit tests pass unchanged

**Step 3:**
- [ ] Remove global setup from demo entry (`demos/assets-spike/app/entry.tsx`)
- [ ] Remove global setup from E2E fixture entry (`e2e/fixtures/app/entry.tsx`)
- [ ] Remove global handling code from runtime
- [ ] All E2E tests pass (verify SSE still connects, HMR still works)
- [ ] Update E2E fixtures as needed

**Step 4:**
- [ ] Remove HTML injection logic from `assets.ts` (remove `interceptHtmlResponse` helper)
- [ ] Remove HMR script tag injection
- [ ] SSE connection still works (first component import triggers it)
- [ ] All E2E tests pass (HMR functionality unchanged)
- [ ] Demo app works without any HMR setup in entry point or HTML

**Step 5:**
- [ ] Delete `generateRuntimeModule()` from `hmr-runtime.ts`
- [ ] Remove any other unused code related to old approach
- [ ] All tests still pass

**Final verification:**
- [ ] Entry points have no HMR setup code (just normal component imports)
- [ ] HTML has no HMR script tags (just normal `<script type="module">` for entry)
- [ ] HMR runtime is fully typed TypeScript with source maps
- [ ] No globals used anywhere in HMR infrastructure
- [ ] Demo and E2E tests demonstrate clean integration

---

### Polish HMR watcher configuration

Improve the file watcher configuration to be more explicit, performant, and maintainable. The current approach works but has accumulated complexity around pattern matching, directory traversal, and the relationship between middleware config and watcher behavior.

**Current issues:**

1. **Implicit pattern mapping** - Middleware `allow` patterns (designed for "what to serve") are repurposed for "what to watch". These aren't quite the same concern - you might want to watch more (to detect deletions) or less (to avoid EMFILE).

2. **Directory traversal heuristics** - The `stats?.isDirectory()` check with "no extension = directory" fallback works but feels fragile. We're guessing when chokidar doesn't give us stats.

3. **Hard-coded standard ignores** - `node_modules`, `.git`, `dist`, `build` are manually listed. Should these be configurable? Derived from `.gitignore`?

4. **Allow vs ignore mental model** - Middleware thinks in "allow these files", but chokidar thinks in "ignore these paths". The inversion in the `ignored` function works but isn't intuitive.

5. **No visibility** - Hard to know if watcher is configured well (how many files, what's ignored, performance impact).

6. **Extensions list is separate** - Watcher has its own `extensions` array that's independent from what middleware can handle. Could get out of sync.

**Open questions to explore:**

- Should watcher config be explicit rather than derived from middleware patterns?
- Could we use a positive "watch these paths" approach instead of "watch root, ignore most things"?
- Should we measure and log: files watched, startup time, memory usage?
- How should `.gitignore` integration work, if at all?
- Should standard ignores be configurable?
- Can we eliminate the directory detection heuristic?
- Should watching be more conservative (only what you need) or liberal (catch everything)?

**Note:** This may lead to changes in the middleware's `allow`/`deny` config if we need to align concepts better. This is TBD and should be explored as part of this task.

**Why this isn't blocking:**

- HMR works correctly
- Performance is acceptable (< 100ms startup in typical projects)
- Complexity is isolated to `hmr-watcher.ts`
- Can improve iteratively

**Acceptance Criteria:**

- [ ] **Correctness**: Watches the right files (no false positives watching unnecessary files, no false negatives missing files that should trigger HMR)
- [ ] **Performance**: Measure and document startup time, file count watched, and memory usage
- [ ] **Usability**: Clear API with good defaults, easy to configure for common cases (monorepo, specific directories, etc.)
- [ ] **Debuggability**: Log or expose metrics about what's being watched (file count, patterns matched, etc.)
- [ ] **Maintainability**: Reduce heuristics, clearer separation of concerns between middleware config and watcher config
- [ ] **Testability**: Unit tests for filtering logic (can test without actually watching filesystem)
- [ ] All existing E2E tests still pass
- [ ] Demo app works in both standalone and monorepo setups

**Implementation notes:**

- Consider whether middleware config should change (explore alignment between serving patterns and watching patterns)
- Document the relationship between `allow`/`deny` patterns and what gets watched
- Consider adding a `watch` option to `DevAssetsOptions` for explicit watcher config (if needed)

---

### Canonical URL redirects for `/__@workspace/`

Ensure one URL per physical file by redirecting `/__@workspace/` requests to simpler URLs when the file's realpath is inside the project root.

**The problem:**

For example, if you're in a workspace package (`packages/web-app/`) with workspace root set to the monorepo root, someone could request `/__@workspace/packages/web-app/utils/helper.js` - but that file is inside the project root, so it should be served at `/utils/helper.js` instead. Serving both URLs for the same file can cause duplicate module instances.

**The solution:**

- Canonical URL is determined by where the file's **realpath** lives
- Realpath inside project root → canonical is `/path/in/project` (no `/__@workspace/`)
- Realpath outside project root → canonical is `/__@workspace/path/from/workspace-root`
- When serving `/__@workspace/` requests, check if realpath is in project root → redirect to canonical URL

**Benefits:**

- Simple projects with local `node_modules` don't need `workspace` config at all
- Monorepos with symlinked workspace packages correctly use `/__@workspace/` (symlink realpath is outside project)
- No duplicate module instances regardless of how files are accessed

**Acceptance Criteria:**

- [ ] `/__@workspace/` requests redirect to `/...` URL when file's realpath is inside project root
- [ ] Symlinked files that resolve outside project root stay at `/__@workspace/` URLs (no redirect)
- [ ] Import rewriting generates canonical URLs (already works, just verify)
- [ ] Unit tests for redirect logic with symlink vs non-symlink cases
- [ ] Demo works without `workspace` config when run in a standalone (non-monorepo) setup

---

### Improve ETag cache invalidation

**The problem:**

ETags are currently based on source file mtime/size. But the transformed output depends on more than just the source:

- Middleware transform logic (esbuild config, import rewriting rules)
- esbuild version
- Other dependencies

If transform logic changes but source files don't, the browser can serve stale cached transforms with outdated import paths (e.g., old URL patterns after renaming).

**Ideas to explore:**

- **Lockfile** - Changes when deps update. Could use mtime or content hash.
- **Middleware package (monorepo only)** - Auto-detect if we're in the Remix monorepo and factor in changes to `packages/dev-assets-middleware/`. This handles active middleware development.

Note: Directory mtime behavior varies by OS (may only update on add/remove, not content changes). May need to hash file list + mtimes, or find most recent file mtime recursively.

**Acceptance Criteria:**

- [ ] ETag invalidates when project dependencies change
- [ ] ETag invalidates when middleware package changes (when developing in monorepo)
- [ ] Solution is computed once at init, not per-request
- [ ] Unit tests for ETag generation with different scenarios

---

### Pre-emptive import transforms (eliminate waterfalls)

**Dependencies:** Module graph task (above)

When transforming a file, proactively transform its immediate imports in the background. This eliminates request waterfalls where the browser must wait for each level of imports sequentially.

**Current behavior (waterfall):**

```
Browser requests /entry.tsx
  → Server transforms (200ms)
  → Browser parses, sees import './utils.ts'
    → Browser requests /utils.ts
      → Server transforms (50ms)
```

**With pre-emptive transforms:**

```
Browser requests /entry.tsx
  → Server transforms entry.tsx
  → Kicks off background transform for ./utils.ts
  → Returns entry.tsx (200ms)
Browser requests /utils.ts
  → Already in cache ✨
  → Instant response
```

**Strategy:**

1. **One level deep only** - Only transform immediate static imports, not transitive
2. **Don't block response** - Kick off background transforms, return immediately
3. **Natural cascade** - Each transform warms its own imports, creates chain reaction
4. **Error handling** - Log errors but don't throw (let browser see error when it requests)

**Why one level?**

- Avoids server spinning on deep import trees
- Most benefit for least work (first hop is most expensive)
- Predictable resource usage

**Error handling:**

```typescript
async warmupRequest(url: string): Promise<void> {
  try {
    await transformRequest(url)
  } catch (error) {
    // Log but don't throw - let browser see real error on request
    logger.warn(`Pre-transform error for ${url}: ${error.message}`)
  }
}
```

**Acceptance Criteria:**

- [ ] After transforming a file, extract static imports
- [ ] Kick off background transforms for immediate imports only (one level)
- [ ] Don't wait for background transforms to complete before returning response
- [ ] Log pre-transform errors but don't throw
- [ ] Performance metrics show reduced waterfall depth
- [ ] Works with module graph caching (doesn't re-transform unnecessarily)

---

### `basePath` option for static-middleware

**Package:** `@remix-run/static-middleware`

Add a `basePath` option to mount static files at a URL prefix, similar to Express's `app.use('/path', express.static(...))` pattern.

```ts
// Current workaround (serves from project root with filter)
staticFiles('.', { filter: (path) => path.startsWith('build/') })

// Desired API
staticFiles('./build', { basePath: '/build' })
```

**Acceptance Criteria:**

- [ ] `basePath` option strips the prefix before looking up files
- [ ] Request to `/build/entry.js` with `basePath: '/build'` serves `./build/entry.js`
- [ ] Requests not matching the basePath fall through to next middleware
- [ ] Works with other options (filter, index, listFiles, etc.)
- [ ] Unit tests for basePath matching and stripping
- [ ] Add change file for the new feature

---

## Testing

**Notes:**

- Future tasks should include tests as part of their acceptance criteria.
- Any new URL patterns must use browser-friendly URLs in source maps (not filesystem paths). Use `parseInlineSourceMap()` in unit tests to verify.

---

## Out of Scope (For Now)

These are explicitly not part of the initial spike:

- **CSS imports** - Use CSS-in-JS or manual `<link>` tags
- **CSS chunk tracking** - Not tracked in manifest, even in prod
- **Pre-bundling** - Future optimization for CJS packages or large dep trees
- **Multiple root directories** - Single root for now
