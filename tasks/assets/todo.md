# Assets Middleware - TODO

NOTE: Tasks that are in progress should be moved to `in-progress.md`.

## Features

### Add HMR handle unregistration to prevent memory leaks

The HMR runtime currently tracks component handles in `Set<handle>` but never removes them when components unmount. This could cause memory leaks during development with dynamically mounted/unmounted components.

**Current situation:**

- `components` Map stores `{ impl, handles: Set<handle> }` with **strong references** to handles
- When components call `__hmr_register(url, name, handle, renderFn)`, handles are added to the Set (line 77 in `hmr-runtime.ts`)
- **No cleanup mechanism** when components unmount or handles are disposed
- HMR iterates over `component.handles.forEach(...)` to propagate updates (requires strong refs, can't use WeakSet)

**Why this matters:**

- Unmounted component handles remain in memory indefinitely
- Long dev sessions with component churn could accumulate stale handles
- Testing scenarios with many mount/unmount cycles could leak
- **However**: This is dev-only, and most components are long-lived during dev sessions, so impact is likely minor in practice

**Potential solution (requires investigation):**

Add cleanup API that `@remix-run/component` calls when disposing handles:

```javascript
export function __hmr_unregister(handle) {
  const metadata = handleToComponent.get(handle)
  if (metadata) {
    const component = components.get(metadata.url)?.get(metadata.name)
    component?.handles.delete(handle)
    handleToComponent.delete(handle)
  }
}
```

**Open questions requiring investigation:**

- Does `@remix-run/component` have lifecycle hooks for handle disposal?
- Should this be called automatically or require explicit cleanup?
- What's the impact on HMR behavior if handles are removed mid-update?
- Is there a way to detect stale handles automatically (e.g., checking if handle is still mounted)?
- Should we add periodic cleanup to remove handles that are no longer reachable?

**Acceptance Criteria:**

- [ ] Investigate `@remix-run/component` handle lifecycle and disposal mechanisms
- [ ] Design cleanup API that integrates with component lifecycle
- [ ] Implement `__hmr_unregister` function
- [ ] Update `@remix-run/component` to call unregister when handles are disposed
- [ ] Add tests for handle cleanup (verify handles are removed from registry)
- [ ] Verify no memory leaks in long-running dev sessions with component churn
- [ ] Document cleanup expectations for framework integrators

**Note:** May require coordination with `@remix-run/component` package. Further investigation needed to determine the right integration points.

### Add custom logger option

The middleware currently uses `console.warn/log/error` for all logging, which creates noise during tests and doesn't integrate with application logging infrastructure.

**Current problems:**

- Security warnings (`Blocked: ...`) spam test output (22+ console calls in `assets.ts`)
- No way to silence or redirect logs during tests
- Can't integrate with application logging systems (winston, pino, etc.)
- Debug logs controlled by environment variable (`DEBUG=assets`) rather than configuration

**Examples of noisy output during tests:**

```
[dev-assets-middleware] Blocked: /__@workspace/packages/lib/index.ts
  No allow pattern matched. Current patterns:
    /node_modules/
  Consider adding: workspace: { allow: [/packages\//] }
```

**Proposed solution:**

Add optional `logger` configuration to `DevAssetsOptions`:

```typescript
interface Logger {
  debug: (message: string, ...args: any[]) => void
  info: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
}

interface DevAssetsOptions {
  // ... existing options
  logger?: Logger  // Defaults to console
}
```

**Benefits:**

- Tests can pass silent logger: `logger: { debug() {}, info() {}, warn() {}, error() {} }`
- Production apps can use their logging infrastructure
- Consistent logging interface
- Better control over log levels

**Acceptance Criteria:**

- [ ] Add `Logger` interface to `DevAssetsOptions`
- [ ] Replace all `console.*` calls with `logger.*` calls
- [ ] Default logger uses `console` (no breaking changes)
- [ ] Update E2E tests to use silent logger (cleaner test output)
- [ ] Document logger option in README/JSDoc
- [ ] All tests pass

### Refactor HMR runtime to real TypeScript module

Convert the HMR runtime from a generated string to a real TypeScript module that goes through the standard transform pipeline. This eliminates globals, enables direct imports, and simplifies the architecture.

**Current problems:**

- HMR runtime is generated as a string (poor authoring experience)
- Uses `window.__hmr_request_remount_impl` global to bridge to `@remix-run/component`
- HTML injection required to bootstrap SSE connection
- Entry points must manually wire up the global with boilerplate: `(window as any).__hmr_request_remount_impl = requestRemount`
- This boilerplate exists in: demo apps (`demos/assets-spike/app/entry.tsx`) and E2E fixtures (`packages/dev-assets-middleware/e2e/fixtures/app/entry.tsx`)
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

- Remove `window.__hmr_request_remount_impl = requestRemount` boilerplate from all entry points:
  - `demos/assets-spike/app/entry.tsx`
  - `packages/dev-assets-middleware/e2e/fixtures/app/entry.tsx`
  - Any other demo apps or examples
- Remove global references from runtime
- Remove the `requestRemount` import from entry points (no longer needed)
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
