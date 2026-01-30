# Assets Middleware - TODO

NOTE: Tasks that are in progress should be moved to `in-progress.md`.

## Features

---

### Architectural: New Handle on Remount

**Context:**

HMR currently works great when only the render function changes - state is preserved, updates are instant. The issue is specifically with **setup scope remounting** when the setup hash changes.

**Current architecture:**

When `requestRemount()` is called during HMR (setup scope changes), we:

1. Abort the old signal and create a new one
2. Clear the render function
3. Call `handle.update()` to re-render

This **reuses the same Handle object** but mutates its signal. While this works for cleanup, it breaks the mental model:

- Handle object stays the same, but signal changes
- In the abort listener, `handle.signal.aborted` is false again (new signal)
- The DOM element is not recreated from scratch, so behavior could potentially differ from a full remount.
- Not intuitive: a handle should be 1:1 with a component instance lifecycle

**Target architecture:**

Remounting should behave like changing a `key` prop in Remix components - full teardown and recreation:

1. **Mark component as stale** when setup scope changes
2. **Schedule re-render from root** (like a state change)
3. **Reconciler creates brand new Handle** during diff (not reused)
4. **Full disconnect/reconnect** with fresh DOM and new lifecycle
5. **Handle is truly 1:1** with component instance

Example - changing key forces full remount:

```tsx
// In Remix component system
<Component key={v1} />  // Instance 1, Handle 1
<Component key={v2} />  // Instance 2, Handle 2 (fresh!)
```

**Why this is better:**

- **Clearer mental model**: Handle = component instance lifetime
- **No mutation**: Old handle stays aborted, new handle is fresh
- **Safer**: No edge cases where code assumes signal state
- **Consistent**: Works like key changes, which developers understand

**Implementation approach:**

This should be treated as **rebuilding setup scope remounting behavior from scratch**, not modifying the existing implementation in place. The current render-only HMR works great - we're specifically addressing the setup scope change scenario.

---

**Investigation: How React-Refresh Achieves Remounting**

Investigation of React-Refresh and vite-plugin-react.

**Key Finding: React Never Mutates Fiber Objects During Remount**

React-Refresh's remounting works by making the **reconciler** create a new Fiber (React's equivalent of our Handle). The runtime never directly remounts - it marks components as stale and lets the reconciler discover them.

**React-Refresh Architecture:**

1. **Component Registration & Families**

   - Every component function is registered with unique ID (filename + export)
   - Components grouped into "families" - a family = all instances of same component type
   - Family tracks: `current` (latest implementation) + signature metadata

2. **Signature Tracking (Hook Order Detection)**

   - Babel injects code to track which hooks are called and in what order
   - Example: `useState{[foo, setFoo](0)}\nuseEffect{}`
   - Runtime collects signatures during execution (not at transform time)

3. **Update Decision: Re-render vs Remount**

   - When HMR update arrives, React compares signatures
   - `canPreserveStateBetween(prevType, nextType)` checks:
     - Both function components (not classes)?
     - Hook signatures match (same hooks, same order)?
   - If YES → `updatedFamilies` (preserve state, just re-render)
   - If NO → `staleFamilies` (remount required)

4. **The Remount Process**
   - For components in `staleFamilies`:
   - React's reconciler has `resolveFamily(type)` that returns the family if stale
   - During reconciliation, if family returned, React treats it as **type change**
   - **Same code path as changing a component's `key` prop**
   - Old Fiber unmounted (effects cleanup, refs cleared)
   - **Brand new Fiber created** with fresh state
   - **Critical: No mutation of existing Fiber objects**

**React's Delegating Pattern:**

React-Refresh doesn't use wrapper functions. Instead:

- The Babel transform registers the actual component function
- When HMR updates, the family's `current` pointer is updated
- Reconciler checks `resolveFamily(type)` to detect staleness
- If stale, reconciler creates new Fiber automatically

**Mapping to Remix Component Model:**

Our current approach differs:

- We use a **delegating wrapper** that calls `__hmr_get_component()`
- The wrapper's identity never changes, but `impl` changes
- We call `requestRemount()` which mutates the Handle's signal
- The reconciler sees "same type (wrapper)" and reuses the Handle

**Critical Pattern from React-Refresh: Inversion of Control**

React-Refresh doesn't reach into React, and React doesn't import HMR code. Instead:

- React's reconciler has a **hook point**: calls `resolveFamily(type)` during reconciliation
- React-Refresh provides the handler: `setRefreshHandler(resolveFamily)`
- During reconciliation, React calls the handler: "Has this type changed?"
- React-Refresh answers based on staleness without React knowing about HMR

**The Handler Pattern in React:**

```js
// In React-Refresh runtime:
function resolveFamily(type) {
  // Only check updated types to keep lookups fast
  return updatedFamiliesByType.get(type)
}

// React-Refresh registers with React via DevTools global hook:
helpers.setRefreshHandler(resolveFamily)

// In React reconciler (conceptually):
function beginWork(current, workInProgress) {
  let family = resolveFamily?.(workInProgress.type)
  if (family) {
    // Type changed, create new fiber
  }
}
```

**Proposed Remix Approach:**

Mirror React's inversion of control: **HMR registers a handler with the reconciler**

**The Minimal Integration: Just One Hook**

```ts
// In reconciler (vdom.ts): Single hook point for staleness checking
// Reconciler doesn't know about HMR - just provides extension point
type ComponentStalenessCheck = (type: Function) => boolean

let componentStalenessCheck: ComponentStalenessCheck | null = null

export function setComponentStalenessCheck(check: ComponentStalenessCheck) {
  componentStalenessCheck = check
}

function reconcileComponent(curr, next, ...) {
  // Check if external handler says component is stale
  // (HMR will provide this handler, but reconciler doesn't import HMR)
  if (curr && componentStalenessCheck?.(curr.type)) {
    // Component is stale - treat as type change
    // Same code path as key change
    remove(curr, ...)
    // Create new handle for next
    next._handle = createComponent(...)
    return
  }
  // Normal case: reuse handle
  next._handle = curr._handle
  ...
}

// In HMR runtime: Register handler on initialization
import { setComponentStalenessCheck } from '@remix-run/component/dev'

// Staleness is scoped to current update batch via microtask cleanup
let stalenessForCurrentUpdate = new Set<Function>()

// Register our staleness checker - this is the ONLY integration point
setComponentStalenessCheck((componentFn) => stalenessForCurrentUpdate.has(componentFn))

// Public API: requestRemount (semantics unchanged, implementation different)
export function requestRemount(handle: Handle) {
  // 1. Get wrapper function for this handle
  let wrapper = handleToWrapper.get(handle)
  if (!wrapper) return

  // 2. Mark component as stale for this update batch
  stalenessForCurrentUpdate.add(wrapper)

  // 3. Clear state
  __hmr_clear_state(handle)

  // 4. Trigger reconciliation using existing API
  // "Something changed, please reconcile"
  // Reconciler will check staleness and create new handle
  handle.update()

  // 5. Schedule cleanup after update completes
  // Microtask runs AFTER flush() processes all updates
  queueMicrotask(() => {
    stalenessForCurrentUpdate.delete(wrapper)
  })
}

// Track handle → wrapper mapping
let handleToWrapper = new WeakMap<Handle, Function>()

// Called from transformed code to register wrapper
export function __hmr_register(url, name, handle, renderFn, wrapper) {
  // Store wrapper for staleness checking
  handleToWrapper.set(handle, wrapper)

  // ... rest of existing registration logic
}

// Internal: Called from transformed component code
export function __hmr_setup(handle, hash, setupFn): boolean {
  let wrapper = handleToWrapper.get(handle)
  if (!wrapper) return false

  let currentHash = setupHashes.get(wrapper)
  if (currentHash === undefined) {
    setupFn()
    setupHashes.set(wrapper, hash)
    return false
  }
  if (currentHash !== hash) {
    // Setup changed - request remount
    setupHashes.set(wrapper, hash) // Update hash
    requestRemount(handle)
    return true // Signal component to return early
  }
  return false
}
```

**Key Benefits of This Pattern:**

1. ✅ **Minimal API surface**: Just one hook point (`setComponentStalenessCheck`)
2. ✅ **Reconciler doesn't import HMR**: Only exports the hook registration function
3. ✅ **HMR is a layer on top**: Registers itself with reconciler via the hook
4. ✅ **Reuses existing primitives**: Uses `handle.update()` to trigger reconciliation
5. ✅ **No circular dependencies**: Clean one-way dependency (HMR → Component)
6. ✅ **Testable in isolation**: Can test reconciler without HMR, test HMR without full reconciler
7. ✅ **Extensible**: Other tools could register staleness checks (not just HMR)
8. ✅ **Natural batching**: Updates batch automatically with existing update mechanism
9. ✅ **Microtask cleanup**: Staleness scoped to update batch, auto-clears after reconciliation

**Implementation Layers:**

1. **Reconciler Hook Point** (new - in `@remix-run/component`)

   - Export `setComponentStalenessCheck(fn)` via `@remix-run/component/dev` subpath
   - Store check function in module-level variable
   - Call check before reusing Handle: `if (check?.(curr.type)) { /* create new */ }`
   - No imports from HMR - just provides extension mechanism
   - **Dev-only export** - not in mainline package exports, signals internal/dev use
   - Add to `package.json` exports: `"./dev": "./src/dev.ts"`
   - **That's it! This is the only change to component package.**

2. **Staleness Tracking** (new - in HMR runtime)

   - Use `Set<Function>` for staleness (scoped to current update batch)
   - Register with reconciler: `setComponentStalenessCheck((fn) => stalenessForCurrentUpdate.has(fn))`
   - Track handle → wrapper mapping: `WeakMap<Handle, Function>`
   - Transform passes wrapper to `__hmr_register` for tracking
   - `requestRemount()` marks stale + calls `handle.update()` + schedules microtask cleanup

3. **Update Flow** (existing mechanism, no changes needed!)

   - `handle.update()` schedules reconciliation (already exists)
   - Reconciler checks staleness during reconciliation
   - Creates new Handle if stale (follows key-change code path)
   - Natural batching with existing update mechanism

4. **Hash Persistence** (solve previous trap #2)

   **Problem**: Hash currently stored per-Handle (WeakMap). New Handle loses hash → "first run" loop.

   **Solution**: Store hash by wrapper function (not Handle)

   ```ts
   // Current (wrong): WeakMap<Handle, string>
   // New (correct): WeakMap<Function, string> - keyed by wrapper
   let setupHashes = new WeakMap<Function, string>()

   // In __hmr_setup:
   export function __hmr_setup(handle, hash, setupFn) {
     let wrapper = handleToWrapper.get(handle)
     let currentHash = setupHashes.get(wrapper)
     if (currentHash === undefined) {
       setupFn()
       setupHashes.set(wrapper, hash)
       return false
     }
     if (currentHash !== hash) {
       setupHashes.set(wrapper, hash) // Update for next check
       requestRemount(handle)
       return true
     }
     return false
   }
   ```

   Wrapper function is stable across remounts, so hash persists correctly.

5. **Staleness Cleanup** (new - microtask pattern)

   **Challenge**: Staleness must persist for all instances in update batch, but clear before next app update.

   **Solution**: Microtask-based cleanup leveraging existing scheduler

   ```ts
   function requestRemount(handle) {
     let wrapper = handleToWrapper.get(handle)
     stalenessForCurrentUpdate.add(wrapper)

     handle.update() // Schedules flush microtask (or reuses existing)

     // Cleanup runs AFTER flush completes
     queueMicrotask(() => {
       stalenessForCurrentUpdate.delete(wrapper)
     })
   }
   ```

   **How it works**:

   - `handle.update()` schedules a flush microtask (if not already scheduled)
   - All updates in same tick share the same flush
   - Flush microtask runs first (reconciliation checks staleness)
   - Cleanup microtask runs next (clears staleness)
   - Future app updates won't see stale state

**Why This Avoids Previous Traps:**

1. ✅ **No scheduler issues**: Old Handle properly removed before new one created
2. ✅ **No hash loss**: Hash tracked by identity, not Handle reference
3. ✅ **No timing issues**: Reconciler decides when to create new Handle
4. ✅ **No retrofitting**: Clean rebuild using existing key-change logic

**What Can Be Kept:**

- ✅ HMR transform (hashing, delegation pattern)
- ✅ Component registration (`__hmr_register`)
- ✅ State storage (`__hmr_state`)
- ✅ Setup hash tracking (just move storage key)

**What Needs Changing:**

- ❌ `requestRemount()` currently mutates Handle (should mark stale + trigger update instead)
- ❌ Hash storage keyed only by Handle (needs to be keyed by wrapper function)
- ❌ Reconciler blindly reuses Handle (needs staleness check hook point)
- ❌ HMR transform doesn't pass wrapper to `__hmr_register` (needs wrapper for tracking)

**Architectural Flow (Inversion of Control):**

```
┌─────────────────────────────────────────────────────────────┐
│  HMR Runtime (Layer on Top)                                 │
│  - Registers with reconciler via setComponentStalenessCheck │
│  - Tracks stale components in Set (scoped to update batch)  │
│  - requestRemount: marks stale + update + microtask cleanup │
└─────────────────────────────────────────────────────────────┘
                     ↓ (registers check function)
┌─────────────────────────────────────────────────────────────┐
│  Component Reconciler (Core Layer)                          │
│  - Exports setComponentStalenessCheck() hook point          │
│  - Calls check before reusing Handle                        │
│  - Creates new Handle if check returns true                 │
│  - No knowledge of HMR internals                            │
└─────────────────────────────────────────────────────────────┘
```

**The Complete Flow:**

```
1. Setup hash changes in component
   ↓
2. __hmr_setup() detects change
   ↓
3. Calls requestRemount(handle)
   ↓
4. Mark component as stale (WeakSet.add)
   ↓
5. Call handle.update() (trigger reconciliation)
   ↓
6. Reconciler runs, reaches component
   ↓
7. Calls staleness check: isStale(curr.type)?
   ↓
8. Check returns true (component in stale set)
   ↓
9. Reconciler follows key-change path
   ↓
10. Removes old Handle, creates new Handle
   ↓
Result: Brand new Handle with fresh lifecycle!
```

**Key Insight: Minimal Integration**

The beauty of this approach is its simplicity:

- **One hook point**: `setComponentStalenessCheck()` in component package
- **Dev-only export**: `@remix-run/component/dev` keeps it out of mainline API
- **No new APIs on Handle**: Reuse existing `handle.update()` for triggering
- **No HMR coupling**: Component package has zero knowledge of HMR
- **Clean semantics**: Mark stale + update = remount emerges naturally

**Implementation Detail:**

```ts
// packages/component/src/lib/refresh.ts (internal file, not exported)
type ComponentStalenessCheck = (type: Function) => boolean
let stalenessCheck: ComponentStalenessCheck | null = null

// Internal setter (used by dev.ts)
export function setComponentStalenessCheck(check: ComponentStalenessCheck) {
  stalenessCheck = check
}

// Internal checker (used by vdom.ts)
export function checkComponentStaleness(type: Function): boolean {
  return stalenessCheck?.(type) ?? false
}
```

```ts
// packages/component/src/dev.ts (public dev API)
import { setComponentStalenessCheck } from './lib/refresh.ts'

// Re-export only the setter - this is the ONLY public API
export { setComponentStalenessCheck }
```

```ts
// packages/component/src/lib/vdom.ts
import { checkComponentStaleness } from './refresh.ts'

function reconcileComponentNode(curr, next, ...) {
  if (curr._handle) {
    // Check if component is stale before reusing
    if (checkComponentStaleness(curr.type)) {
      // Component is stale - treat as new component
      remove(curr, ...)
      next._handle = createComponent(...)
      // Continue with new handle...
    } else {
      // Normal case: reuse existing handle
      next._handle = curr._handle
      // ...
    }
  }
}
```

This way:

- `@remix-run/component/dev` only exports `setComponentStalenessCheck` (public API)
- Internal `refresh.ts` contains the setter and checker
- `vdom.ts` uses the checker directly from internal file
- Consumers can't access `checkComponentStaleness`
- HMR manages staleness lifecycle (add + microtask cleanup)

The weirdness of calling `handle.update()` on a handle that will be replaced is actually elegant:

- You're not asking the handle to update itself
- You're triggering the reconciliation process
- During reconciliation, staleness is discovered
- Result: handle gets replaced, not updated

---

**Implementation Details & Current Code Structure:**

**Current File Locations:**

- `requestRemount()`: `packages/component/src/lib/component.ts` (exported function)
- `registerComponent()`: `packages/component/src/lib/component.ts` (exported function)
- Component reconciliation: `packages/component/src/lib/vdom.ts` (in `reconcileComponentNode` function)
- HMR runtime: `packages/dev-assets-middleware/src/virtual/hmr-runtime.ts`
- HMR transform: `packages/dev-assets-middleware/src/lib/hmr-transform.ts`

**Where to Add Staleness Check:**

In `vdom.ts`, find the `reconcileComponentNode` function. It currently has logic like:

```ts
if (curr._handle) {
  // Reuse existing handle
  next._handle = curr._handle
  // ...
} else {
  // Create new handle
  next._handle = createComponent(...)
}
```

Add the staleness check BEFORE reusing the handle:

```ts
if (curr._handle) {
  // NEW: Check if component is stale before reusing
  if (checkComponentStaleness(curr.type)) {
    // Component is stale - treat as new component
    // Follow the same path as when key changes
    remove(curr, ...)
    next._handle = createComponent(...)
    // Continue with new handle (same as key change path)...
  } else {
    // Normal case: reuse existing handle
    next._handle = curr._handle
    // ...
  }
}
```

**Component Type Reference:**

In the wrapper pattern:

- `curr.type` is the **wrapper function** (stable identity)
- The wrapper calls `__hmr_get_component()` to get the impl
- Staleness check should use `curr.type` (the wrapper)
- This works because the wrapper identity never changes

**Package.json Exports:**

Add to `packages/component/package.json`:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./dev": "./src/dev.ts"
  }
}
```

**HMR Transform Changes:**

The transform must pass the wrapper function to `__hmr_register` for tracking:

```ts
// Current transform generates:
function Counter__impl(handle) {
  // ... impl
}
__hmr_register_component(url, 'Counter', Counter__impl)

function Counter(handle) {
  let impl = __hmr_get_component(url, 'Counter')
  return impl(handle)
}

// NEW: Pass wrapper as 5th parameter
function Counter__impl(handle) {
  // ... impl
}
__hmr_register_component(url, 'Counter', Counter__impl)

function Counter(handle) {
  let impl = __hmr_get_component(url, 'Counter')
  return impl(handle)
}

// Inside impl, register wrapper:
__hmr_register(url, 'Counter', handle, renderFn, Counter)
//                                              ^^^^^^^ wrapper reference
```

The wrapper can reference itself by name, so the transform just passes `Counter` as the 5th parameter.

---

**Common Implementation Questions:**

**Q: Why store hash by wrapper function instead of Handle?**
A: Handles are recreated on remount, so WeakMap<Handle, hash> loses the hash. Wrapper function identity is stable across remounts, so WeakMap<Function, hash> preserves the hash.

**Q: How does the microtask cleanup prevent staleness from persisting?**
A: The scheduler batches updates in a flush microtask. When we call `handle.update()`, it schedules (or reuses) this flush. We then queue our cleanup microtask, which runs AFTER the flush completes. This ensures all instances are reconciled while staleness is still set, then staleness clears before any future app updates.

**Q: What if multiple components remount in the same tick?**
A: All `requestRemount()` calls add to the same `stalenessForCurrentUpdate` set and share the same flush microtask. Each queues its own cleanup microtask, but they all delete from the same set (deletion is idempotent). After the flush, all cleanup microtasks run and the set is empty.

**Q: Why call `handle.update()` on a stale handle?**
A: We're not asking the handle to update itself - we're triggering the reconciliation process. During reconciliation, staleness is discovered and the handle is replaced. It's semantically "something changed, reconcile", not "update yourself".

**Q: What if staleness check returns true but handle creation fails?**
A: The cleanup microtask still runs and clears staleness, so it won't retry. The error propagates normally through the reconciler - same as any component mount error.

**Q: Do we need to handle component unmount specially?**
A: No. When a component unmounts, the wrapper function becomes unreachable and GC handles cleanup. The WeakMap entries are automatically removed.

**Q: What if a component is marked stale but never updates?**
A: The cleanup microtask still runs and removes it from the staleness set. If the component truly never updates, staleness is cleared anyway (defensive cleanup).

---

**CRITICAL: Test environment must work**

Before beginning implementation, verify you can run all tests for both packages:

```bash
# Component package tests
cd packages/component && pnpm test

# Dev assets middleware tests (including e2e browser tests)
cd packages/dev-assets-middleware && pnpm test
# or, scoped to just unit or browser tests
cd packages/dev-assets-middleware && pnpm test:unit
cd packages/dev-assets-middleware && pnpm test:e2e
```

**If at any point during development you cannot run these tests due to permissions issues, DO NOT PROCEED.** A broken test loop means you cannot validate changes. Stop and report the issue - don't try to work around it or continue without tests.

**Important: Upfront design needed**

Before implementing, spend time understanding and documenting:

- How setup scope hashing should work with new handles
- How HMR bookkeeping (tracking, state storage) coordinates with handle lifecycle
- The complete flow from "setup hash changed" → "new handle mounted"
- What from the current implementation can be kept vs. rebuilt
- The HMR transform is likely fine (hashing, storing), but validate this

Previous attempts stalled by trying to retrofit the new model into existing code, causing cascading timing issues. Build the mental model first, then implement in testable layers.

**Implementation Strategy:**

**CRITICAL: Test the refresh mechanism in isolation first**

Before touching the HMR layer, implement and test the core refresh flow:

1. **Add refresh hook to reconciler** (`packages/component/src/lib/refresh.ts` + `dev.ts`)
2. **Add staleness check to reconciler** (`vdom.ts` - the `if (checkComponentStaleness(curr.type))` branch)
3. **Write unit tests** (`packages/component/src/lib/component.test.tsx` or new test file):

   - Test that you can manually mark a component as stale and trigger remount
   - Verify new Handle is created (different object identity)
   - Verify new DOM element is created (different element reference)
   - Verify old Handle is properly removed/aborted
   - Test with multiple instances of same component
   - Test staleness clears after reconciliation
   - Example test pattern:

   ```ts
   test('component remounts when marked stale', () => {
     let stalenessSet = new Set<Function>()
     setComponentStalenessCheck((fn) => stalenessSet.has(fn))

     let MyComponent = (handle) => {
       return <div>Hello</div>
     }
     let handle1 = mount(MyComponent)
     let domElement1 = handle1.frame.firstChild // Capture DOM reference

     // Mark as stale and trigger update
     stalenessSet.add(MyComponent)
     handle1.update()

     // Wait for microtask
     await Promise.resolve()

     // Verify new handle and new DOM were created
     let handle2 = getCurrentHandle()
     let domElement2 = handle2.frame.firstChild

     assert(handle1 !== handle2, 'Should create new handle')
     assert(domElement1 !== domElement2, 'Should create new DOM element')
     assert(!document.contains(domElement1), 'Old DOM should be removed')
     assert(document.contains(domElement2), 'New DOM should be in document')
     assert(stalenessSet.size === 0, 'Should clear staleness')
   })
   ```

Only after these tests pass should you move to HMR integration.

**Then build HMR layer on top:**

4. HMR runtime changes (wrapper tracking, hash storage, requestRemount)
5. HMR transform changes (pass wrapper to \_\_hmr_register)
6. Integration and e2e verification

This ensures the core assumption (remount without identity change) works before adding HMR complexity.

**Known traps from previous attempt:**

1. **Scheduler queuing old components**: Old component nodes stayed in scheduler's queue after removal, causing infinite "render called after component was removed" loops.

2. **Setup hash loss during remount**: When creating new handle, setup hash was lost, causing `__hmr_setup` to run as "first run" repeatedly. This happened because hash was stored per-handle (WeakMap), and creating a new handle lost the hash. Attempted solution was transferring hash via pending map keyed by component identity (`moduleUrl:componentName`), but timing issues persisted.

3. **Timing issues with handle.update()**: Calling `handle.update()` on old handle during remount caused race conditions.

4. **Retrofitting vs. rebuilding**: Trying to change architecture in place while keeping existing behavior caused cascading issues.

**Acceptance Criteria:**

- [x] **Mental model documented**: Clear description of setup hash tracking, bookkeeping, and remount flow before implementation (see Investigation section above)
- [x] **Validation of existing parts**: Confirm what from current HMR (transform, hashing) can be kept (see Investigation section above)
- [ ] **Refresh mechanism tests pass**: Unit tests verify staleness check triggers remount correctly (test in isolation before HMR)
- [ ] `requestRemount` triggers full teardown/recreation (like key change)
- [ ] New Handle created with fresh signal (1:1 Handle:instance)
- [ ] New DOM element created (no reuse of old DOM nodes)
- [ ] Old Handle stays aborted (no mutation back to earlier state)
- [ ] Setup hash correctly tracked across remounts (no "first run" loops)
- [ ] No infinite loops or "render after removed" warnings
- [ ] No scheduler issues with old components
- [ ] All tests pass (unit + integration + e2e)
- [ ] Demo app HMR works with setup scope changes

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
