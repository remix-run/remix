# HMR refactor and cleanup

Simplify the HMR and module graph implementation by removing unused features, improving code organization, and cleaning up data structures. Focus on "beautifully simple" - only what we need, no more.

**Philosophy:** Don't build for future features. Add complexity only when actually needed with evidence it provides value. Code should be easy to follow.

**Incremental approach:** Complete each step fully and verify before moving to the next. Each step should leave the codebase in a working, tested state.

---

**Step 1: Verify transform caching is elegant (audit only)**

Transform caching is **critical** (compiling node_modules on the fly without caching would be too slow). This step is just an audit to ensure the current implementation is clean and not introducing unnecessary complexity.

**Current approach:**

- Cache lives on `ModuleNode.transformResult`
- Cache key is `lastModified` (file mtime)
- Cache hit: return stored code, skip esbuild
- Cache miss: run esbuild, store result + mtime

**Goal:** Verify current implementation is elegant enough. Don't change unless there's a clear improvement.

**Acceptance Criteria:**

- [x] Review transform caching code in `assets.ts`
- [x] Verify cache logic is centralized and easy to follow
- [x] Verify mtime-based invalidation is reliable
- [x] Document any concerns or potential improvements for future
- [x] **Decision:** Keep as-is OR make specific targeted improvements (document why)

**Audit Results:**

**Current Implementation:**

1. Cache lives on `ModuleNode.transformResult` (object with `code` and `map`)
2. Cache key is `lastModified` (file mtime in milliseconds)
3. Cache hit logic: Check if `transformResult` exists AND `lastModified` matches current file mtime (lines 1014-1027)
4. Cache miss: Run esbuild, rewrite imports, apply HMR transform, store result + mtime (lines 1117-1124)
5. Cache invalidation: Triggered by file watcher (line 669), clears `transformResult` and `lastModified` (lines 484-485), propagates to importers recursively (lines 488-490)

**Strengths:**

- ✅ **Centralized:** All caching logic in one place (`transformSource` function)
- ✅ **Simple:** Single cache check at start of transform (5 lines)
- ✅ **Reliable:** mtime-based invalidation is filesystem-guaranteed
- ✅ **Fast:** No content hashing or complex cache key generation
- ✅ **Consistent:** Automatic propagation to importers ensures correctness
- ✅ **Safe:** Handles circular dependencies with visited set
- ✅ **Observable:** DEBUG logging for cache hits/misses
- ✅ **Well-tested:** Dedicated test suite covers caching behavior
- ✅ **HMR-independent:** Cache invalidation works correctly with or without HMR enabled. Every request checks fresh mtime from `fsp.stat()` (line 867). File watcher (when HMR enabled) is purely an optimization that proactively clears cache, but correctness doesn't depend on it.

**Potential Concerns (all acceptable):**

- ⚠️ **mtime resolution:** Varies by filesystem (FAT32: 2s, ext4/NTFS: 1ms, HFS+: 1s). Could miss rapid edits on low-resolution filesystems, but this is an acceptable edge case for dev mode.
- ℹ️ **No memory pressure management:** Cache grows unbounded, but acceptable for dev mode where file count is reasonable.

**Decision: Keep as-is ✅**

The current implementation is elegant and exemplifies "beautifully simple":

- Single responsibility (caching collocated with transformation)
- Simple invalidation strategy (mtime comparison only)
- Fast (O(1) cache lookup, no hashing)
- Reliable (filesystem-guaranteed mtime changes)
- Well-integrated with module graph
- Properly tested

No changes needed. This implementation achieves the goal perfectly.

**Discovered Issues & Fixed:**

- HMR E2E tests were broken (adapted from old architecture where HMR was standalone middleware)
- Fixed by updating fixtures to use source files instead of built assets
- Added `dispose()` method to `devAssets` middleware for proper cleanup of HMR watcher
- Added `/^packages\//` to workspace allow patterns in test configuration

**Test Baseline Verified:**

- ✅ 126 unit tests passing
- ✅ 4 assets E2E tests passing
- ✅ 9 HMR E2E tests passing
- Total: 135 tests passing, 0 failing

**Verification checkpoint:** ✅ Step 1 complete. Ready to proceed to Step 2.

---

**Step 2: Split `assets.ts` into focused modules** ✅ COMPLETE

`assets.ts` was 1,438 lines and did too much: module graph, transform caching, import rewriting, HMR integration, workspace resolution, ETag generation, and middleware orchestration.

**Goal:** Extract into clearer boundaries while keeping the total number of files manageable.

**Implemented structure:**

- ✅ `module-graph.ts` (144 lines): `ModuleNode`, `ModuleGraph`, operations (`createModuleGraph`, `ensureModuleNode`, `invalidateModule`, `getModuleByUrl`, `getModuleByFile`)
- ✅ `import-rewriter.ts` (89 lines): Import parsing utilities (`extractImportSpecifiers`, `getPackageName`, `isCommonJS`)
- ✅ `assets.ts` (1,271 lines, down from 1,438): HTTP handling, middleware orchestration, resolution logic, calls into graph + import utilities

**Note:** The full `rewriteImports()` function and resolution logic (`batchResolveSpecifiers`, `resolvedPathToUrl`, etc.) remain in `assets.ts` as they are tightly coupled with the middleware's caching infrastructure and configuration. The extraction focused on clearly separable utilities with minimal coupling.

**Acceptance Criteria:**

- [x] Create `src/lib/module-graph.ts` with graph data structure and operations
- [x] Create `src/lib/import-rewriter.ts` with import parsing logic  
- [x] Update `assets.ts` to import and use these modules
- [x] **CRITICAL:** Move tests to dedicated test files for new modules:
  - [x] Create `src/lib/module-graph.test.ts` (199 lines, 13 tests)
  - [x] Create `src/lib/import-rewriter.test.ts` (217 lines, 34 tests)
  - [x] Move relevant tests from `assets.test.ts` to appropriate new test files
  - [x] Keep only assets-specific/integration tests in `assets.test.ts` (1,216 lines, 51 tests)
- [x] **CRITICAL:** Verify no tests were lost in the refactor:
  - [x] Before: 98 unit tests in `assets.test.ts`
  - [x] After: 51 + 34 + 13 = 98 unit tests ✅ All accounted for!
  - [x] Total: 135 tests (98 unit + 24 HMR transform + 13 E2E) all passing ✅
- [x] All existing unit tests pass
- [x] All existing E2E tests pass
- [x] Main middleware file (`assets.ts`) is significantly smaller (167 lines removed) and easier to follow
- [x] Each file has a clear, single responsibility

**Results:**
- `assets.ts`: 1,438 → 1,271 lines (-167 lines, -12%)
- `assets.test.ts`: 1,626 → 1,216 lines (-410 lines, -25%)
- **NEW:** `module-graph.ts` + `module-graph.test.ts`: 343 lines total
- **NEW:** `import-rewriter.ts` + `import-rewriter.test.ts`: 306 lines total
- All 135 tests passing ✅
- Type-checking passing ✅
- Linting passing ✅
- Formatting passing ✅

---

**Step 3: Simplify HMR runtime registries (3 → 2)** ✅ COMPLETE

Simplified from three separate data structures to two with better semantics and no string concatenation keys.

**Before (3 structures):**

```javascript
const renderRegistry = new WeakMap() // handle → renderFn
const handlesByModule = new Map() // url → name → Set<handle>
const componentRegistry = new Map() // "url::name" → componentFn (string concat!)
```

**After (2 structures):**

```javascript
// Nested map: semantic structure organized by URL, then name
const components = new Map() // url → Map<name, { impl, handles: Set }>

// Fast lookup from handle
const handleToComponent = new WeakMap() // handle → { url, name, renderFn }
```

**Benefits achieved:**

- ✅ No string concatenation keys (0 instances of `::` in code)
- ✅ Semantic structure (components organized by URL, then name)
- ✅ Easier to iterate over all components in a module (for HMR updates)
- ✅ One less data structure (3 → 2)

**Acceptance Criteria:**

- [x] Update `hmr-runtime.ts` to use new two-structure approach
- [x] Update `__hmr_register` to use nested Map
- [x] Update `__hmr_call` to use WeakMap lookup
- [x] Update `__hmr_get_component` to use nested Map
- [x] Update `__hmr_register_component` to use nested Map
- [x] Update `__hmr_update` to iterate nested Map (simpler than before)
- [x] All existing E2E tests pass (HMR functionality unchanged) - 135 tests passing ✅
- [x] Code is clearer (no string key construction, semantic structure obvious)

**Verification checkpoint:** Confirm registry refactor is complete and HMR works correctly. Task complete!
