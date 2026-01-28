# Assets Middleware - TODO

NOTE: Tasks that are in progress should be moved to `in-progress.md`.

## Features

### Refactor HMR component state storage to prevent prototype pollution

The HMR runtime stores component state in plain JavaScript objects, which is unsafe. Reserved property names like `__proto__`, `constructor`, `prototype`, etc. could break HMR or cause other issues. Additionally, HMR infrastructure state (`__setupHash`) shares the same namespace as component state, increasing collision risk.

**Current situation:**

```typescript
let hmrState = new WeakMap<any, { __setupHash?: string; [key: string]: any }>()

export function __hmr_state(handle: any) {
  if (!hmrState.has(handle)) {
    hmrState.set(handle, {}) // Plain object - unsafe!
  }
  return hmrState.get(handle)
}

// Used by transformed components:
let __s = __hmr_state(handle)
if (
  __hmr_setup(handle, __s, 'HASH', () => {
    __s.count = 0 // Component state stored as properties
    __s.name = 'test' // All closure variables become object properties
  })
) {
  // ...
}
// Also stores HMR internal:
state.__setupHash = hash // HMR infrastructure state
```

**Why component state storage is needed:**

Remix components are functions that return functions: `function Counter(handle) { let count = 0; return () => <div>{count}</div> }`. State lives in the closure of the outer function. When HMR updates:

1. We need to call the NEW component function to get the new render logic
2. But we want the NEW render function to access the OLD state values (preserve user's counter, form inputs, etc.)
3. The HMR transform converts closure variables to properties on a shared state object: `let count = 0` → `__s.count = 0`
4. This way, the state object persists across HMR updates and the new component function can reference it

This is fundamental to how HMR works with the function-returning-function component architecture - we can't remove state storage.

**Problems:**

1. **Prototype pollution risk**: Using plain objects (`{}`) means reserved property names like `__proto__`, `constructor`, `prototype`, `toString`, `hasOwnProperty` could break HMR or cause security issues if components use these as variable names
2. **Mixed concerns**: HMR infrastructure state (`__setupHash`) and component state (e.g., `count`, `name`) share the same object namespace
3. **Name collision risk**: If a component uses `__setupHash` as a state variable, it breaks HMR
4. **Unclear ownership**: No clear boundary between HMR properties and component properties
5. **Type safety**: Must use loose `[key: string]: any` type to accommodate both concerns

**Potential approaches:**

**Option 1: Separate WeakMaps with safe objects**

```typescript
let setupHashes = new WeakMap<any, string>()
let componentState = new WeakMap<any, Map<string, any>>() // Use Map, not object!

// Component state is safe from prototype pollution
export function __hmr_state(handle: any): Map<string, any> {
  if (!componentState.has(handle)) {
    componentState.set(handle, new Map())
  }
  return componentState.get(handle)!
}

// Usage would change to:
// __s.set('count', 0) instead of __s.count = 0
// But this requires transform changes

// Setup hash is internal
export function __hmr_setup(handle: any, state: any, hash: string, setupFn: () => void) {
  let currentHash = setupHashes.get(handle)
  if (currentHash === undefined) {
    setupFn()
    setupHashes.set(handle, hash)
    return false
  }
  // ...
}
```

**Option 2: Namespaced property with null-prototype object**

```typescript
// Store HMR internal state under a symbol to avoid collisions
const HMR_INTERNAL = Symbol('hmr-internal')

let hmrState = new WeakMap<any, { [HMR_INTERNAL]?: { hash: string }; [key: string]: any }>()

export function __hmr_state(handle: any) {
  if (!hmrState.has(handle)) {
    // Use null prototype to prevent __proto__, constructor, etc. issues
    let state = Object.create(null)
    state[HMR_INTERNAL] = {}
    hmrState.set(handle, state)
  }
  return hmrState.get(handle)!
}

// Component state uses regular properties (safe from prototype with Object.create(null))
state.count = 0 // Safe
state.__proto__ = x // Also safe now (just a regular property)
state[HMR_INTERNAL].hash = 'abc' // HMR internal
```

**Option 3: Use Object.create(null) with separate hash storage (simplest)**

```typescript
let setupHashes = new WeakMap<any, string>()
let componentState = new WeakMap<any, Record<string, any>>()

export function __hmr_state(handle: any) {
  if (!componentState.has(handle)) {
    // Null-prototype object prevents prototype pollution
    componentState.set(handle, Object.create(null))
  }
  return componentState.get(handle)!
}

export function __hmr_setup(handle: any, state: any, hash: string, setupFn: () => void) {
  let currentHash = setupHashes.get(handle)
  if (currentHash === undefined) {
    setupFn()
    setupHashes.set(handle, hash)
    return false
  }
  // ...
}

// Component state uses regular property syntax (safe from pollution)
state.count = 0
state.__proto__ = x // Just a regular property, not a security issue
```

**This is the recommended approach**: Minimal changes, keeps existing transform, fixes prototype pollution, separates HMR hash from component state.

**Recommended approach:**

Option 3 (Object.create(null) with separate hash storage) is the simplest and safest:

- Fixes prototype pollution with minimal code changes
- Separates HMR hash from component state (cleaner concerns)
- Keeps existing transform syntax (`__s.count = 0`)
- No transform changes needed

**Acceptance Criteria:**

- [ ] Replace plain object (`{}`) with `Object.create(null)` in `__hmr_state`
- [ ] Create separate `setupHashes` WeakMap for HMR infrastructure
- [ ] Update `__hmr_setup` to use `setupHashes` instead of `state.__setupHash`
- [ ] Remove `__setupHash` from the state object type
- [ ] Component state remains safe from prototype pollution (`__proto__`, `constructor`, etc. become regular properties)
- [ ] No transform changes needed (still uses `__s.count = 0` syntax)
- [ ] All existing E2E tests pass (HMR behavior unchanged)
- [ ] All unit tests pass
- [ ] Update comments to clarify that component state persists across HMR updates

---

### Fix source map paths to match URL structure

Source maps currently contain filesystem-relative paths, causing browser dev tools to organize the Sources panel tree incorrectly. The tree structure doesn't match the Network panel or actual URL structure, creating a confusing developer experience.

**Current situation:**

Source maps are generated by esbuild with filesystem-relative paths like `../../packages/dev-assets-middleware/src/lib/hmr-runtime.module.ts`. Even though `sourcesContent` is embedded (so sources are technically available), the browser uses these paths to organize the **dev tools Sources panel tree**, creating a messy structure that doesn't match how files are actually served.

**What the tree looks like now (broken):**

```
├── packages/               (from relative ../../packages path)
│   └── dev-assets-middleware/
├── app/app/                (duplicate nested structure)
│   └── components/
├── __@workspace/packages/  (correct structure)
└── localhost:44100/        (mixing URLs with filesystem paths)
```

**What we want (clean, matches Network panel):**

```
├── __@remix/
│   └── hmr/
│       └── runtime.js
├── __@workspace/
│   └── packages/
│       ├── component/
│       └── dev-assets-middleware/
└── assets/
    └── components/
        └── Counter.tsx
```

**Examples:**

- **HMR runtime**: Served at `/__@remix/hmr/runtime.js`, source map says `../../packages/dev-assets-middleware/...`

  - Creates weird `packages/` folder at root level in dev tools tree
  - Should say: `/__@workspace/packages/dev-assets-middleware/src/lib/hmr-runtime.module.ts`

- **App files**: Served at `/assets/components/Counter.tsx`, source map says `../components/Counter.tsx`
  - Creates `app/` nested folders
  - Should say: `/assets/components/Counter.tsx`

**Why this matters:**

- Dev tools Sources tree doesn't match Network panel structure
- Hard to find files in dev tools (they're not where you expect)
- Duplicate/confusing folder structures
- Inconsistent organization across different file types
- Poor developer experience when debugging

**Solution approach:**

In an **unbundled dev setup**, each source file has its own URL where it's served. The source map's `sources` array should reference that **same URL** (not a filesystem path).

After esbuild transformation:

1. Parse the inline source map from transformed code
2. Replace the `sources` array with the `sourceUrl` parameter (the URL where this file is served)
3. Preserve `sourcesContent` (actual TypeScript source - already embedded by esbuild)
4. Re-encode and replace the source map

This needs to happen in the `transformSource` function after esbuild but before caching.

**Implementation notes:**

- Source maps are inline base64-encoded JSON
- The `sourceUrl` parameter in `transformSource` tells us exactly where the file will be served
- Simply replace `sources` array with `[sourceUrl]`
- Keep `sourcesContent` as-is (the actual source code)
- Works for workspace files, app files, and HMR runtime

**Acceptance Criteria:**

- [ ] Dev tools Sources tree structure matches Network panel URLs
- [ ] No duplicate or weirdly nested folder structures
- [ ] HMR runtime shows under `__@remix/hmr/` in Sources tree
- [ ] Workspace files show under `__@workspace/packages/` in Sources tree
- [ ] App files show under their serve path (e.g., `/assets/`) in Sources tree
- [ ] Can still set breakpoints and debug TypeScript (sourcesContent preserved)
- [ ] Can still step through TypeScript code
- [ ] Errors still show correct TypeScript line numbers
- [ ] All existing tests still pass
- [ ] Source map correction is cached (no performance regression)

---

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
