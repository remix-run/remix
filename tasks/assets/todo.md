# Assets Middleware - TODO

NOTE: Tasks that are in progress should be moved to `in-progress.md`.

## Features

---

### Add HMR handle unregistration to prevent memory leaks

**Status:** 🚫 **BLOCKED** - Waiting on component library investigation

**Blocker:** Conditional rendering in the component library doesn't call component `remove()` or abort `handle.signal`. Need to investigate and fix component library behavior before implementing HMR cleanup.

**Problem:**

The HMR runtime currently tracks component handles in `Set<handle>` but never removes them when components unmount. This causes:

1. **Memory leaks** - unmounted handles remain in memory indefinitely
2. **Stale HMR updates** - HMR may try to interact with unmounted component handles

**Solution approach validated:**

✅ Hook into existing AbortSignal mechanism - listen for `handle.signal` abort event in `__hmr_register` to clean up when component unmounts. No new component API needed!

**Investigation complete - Key findings:**

1. **Signal mechanism works correctly:**

   - Components receive `Handle` with `signal` property (AbortSignal)
   - Signal is aborted when component's `remove()` function is called
   - Each instance gets unique handle with own signal

2. **Component library bug discovered:**

   - Conditional rendering (`{show && <Component />}`) removes component from DOM
   - BUT does NOT call component's `remove()` function or abort `handle.signal`
   - Component remains "alive" in framework, just not rendered
   - Test gap: No test exists for parent conditionally rendering child component
   - Root rendering `root.render(null)` DOES abort signal correctly

3. **Empirical evidence:**
   - Created Toggle component that conditionally renders Counter: `{showCounter && <Counter />}`
   - Toggled Counter off - confirmed removed from DOM (`visible: false`)
   - Both Counter instances showed `signal.aborted: false`
   - Expected: signal should be `true` for unmounted instance

**HMR cleanup implementation ready:**

The implementation is straightforward once component library is fixed:

```typescript
// In __hmr_register, after adding handle to Set:
handle.signal.addEventListener('abort', function () {
  // Remove handle from handles Set
  componentEntry.handles.delete(handle)

  // Clean up state storage
  __hmr_clear_state(handle)

  // Clean up metadata
  handleToComponent.delete(handle)

  // Clean up empty entries
  if (componentEntry.handles.size === 0) {
    moduleComponents.delete(componentName)
    if (moduleComponents.size === 0) {
      components.delete(moduleUrl)
    }
  }
})
```

**Testing strategy (CRITICAL):**

The test MUST be written to verify it can actually fail:

1. **Write the test first** - Create e2e test that unmounts a component, triggers HMR update, and checks for errors
2. **Verify test FAILS without cleanup** - Comment out the cleanup listener code, run test, confirm it fails
3. **Verify test PASSES with cleanup** - Restore cleanup listener code, run test, confirm it passes

**Why this is critical:**

During investigation, we created a test using conditional rendering (`{show && <Counter />}`) to unmount a component. The test passed even when cleanup was disabled! This revealed that conditional rendering doesn't abort the signal, making it a bad test scenario.

**What the test should catch:**

Without cleanup, HMR attempts to call `handle.update()` on unmounted components. This should either:

- Produce console errors (component tries to interact with removed DOM nodes)
- Throw exceptions (accessing properties on disconnected handles)
- Show HMR trying to update non-existent instances

The test must verify that these errors/behaviors DON'T happen when cleanup is enabled.

**Next steps:**

1. **Fix component library:** Ensure conditional rendering calls `remove()` and aborts signal
2. **Add component test:** Test that `{show && <Component />}` toggle aborts child signal
3. **Return to this task:** Implement HMR cleanup (code above)
4. **Add e2e test:** Verify HMR doesn't update unmounted components

**Files to modify when unblocked:**

- `packages/dev-assets-middleware/src/virtual/hmr-runtime.ts` - add cleanup listener in `__hmr_register`
- `packages/dev-assets-middleware/e2e/hmr.playwright.ts` - add test for conditional unmount scenario

**Current HMR bookkeeping (for reference):**

- `components` Map: `url → Map<name, { impl, handles: Set<handle> }>`
- `handleToComponent` WeakMap: `handle → { url, name, renderFn }`
- `componentState` WeakMap: `handle → ComponentState`
- `setupHashes` WeakMap: `handle → hash`

---

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
  logger?: Logger // Defaults to console
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
- [ ] **Source maps use canonical URLs** - The `sourceUrl` passed to `transformSource()` and `fixSourceMapPaths()` must be the canonical URL (after redirect), ensuring compiled files and their sources are always in sync in browser DevTools
- [ ] Import rewriting generates canonical URLs (already works, just verify)
- [ ] Unit tests for redirect logic with symlink vs non-symlink cases
- [ ] Unit tests verify source maps contain canonical URLs using `parseInlineSourceMap()`
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
