# Architectural: New Handle on Remount

## The Problem

HMR works great when only the render function changes - state is preserved, updates are instant. The issue was specifically with **setup scope remounting** when the setup hash changes.

**Previous architecture (broken):**

When `requestRemount()` was called during HMR (setup scope changes), we:

1. Aborted the old signal and created a new one
2. Cleared the render function
3. Called `handle.update()` to re-render

This **reused the same Handle object** but mutated its signal:

- Handle object stayed the same, but signal changed
- In the abort listener, `handle.signal.aborted` became false again (new signal)
- The DOM element was not recreated from scratch
- Not intuitive: a handle should be 1:1 with a component instance lifecycle

## The Solution

Remounting now behaves like changing a `key` prop in Remix components - full teardown and recreation:

1. **Mark component as stale** when setup scope changes
2. **Trigger reconciliation from root** (not from individual handle)
3. **Reconciler creates brand new Handle** during diff (not reused)
4. **Full disconnect/reconnect** with fresh DOM and new lifecycle
5. **Handle is truly 1:1** with component instance

Example - like key changes:

```tsx
// In Remix component system
<Component key={v1} />  // Instance 1, Handle 1
<Component key={v2} />  // Instance 2, Handle 2 (fresh!)
```

## Key Architecture: Inversion of Control

The solution uses a **staleness check pattern** where HMR registers a handler with the reconciler:

**Minimal Integration:**

```ts
// In reconciler (vdom.ts): Single hook point for staleness checking
export let componentStalenessCheck: ComponentStalenessCheck | null = null

export function setComponentStalenessCheck(check: ComponentStalenessCheck) {
  componentStalenessCheck = check
}

// In diffComponent:
if (curr._handle && componentStalenessCheck?.(curr.type)) {
  // Component is stale - treat as type change (like key change)
  remove(curr, ...)
  next._handle = createComponent(...)
}
```

**HMR Runtime:**

```ts
// HMR registers with reconciler
import { setComponentStalenessCheck } from '@remix-run/component/dev'

let stalenessForCurrentUpdate = new Set<string>()
setComponentStalenessCheck((componentFn) => {
  let key = componentToKey.get(componentFn) // moduleUrl:componentName
  return stalenessForCurrentUpdate.has(key)
})

// When setup hash changes:
__hmr_clear_state(handle)
stalenessForCurrentUpdate.add(hashKey) // Mark stale
requestReconciliation() // Trigger from root
// Microtask cleans up staleness after reconciliation
```

## Key Implementation Details

**1. Stable Keys Across HMR Updates:**

Setup hashes stored by `moduleUrl:componentName` instead of function identity (which changes on HMR reload):

```ts
let setupHashes = new Map<string, string>()
let componentToKey = new WeakMap<Function, string>()
```

**2. State Emptiness Detection:**

Distinguish between "old handle detecting change" vs "new handle after remount":

```ts
if (currentHash !== hash) {
  let stateIsEmpty = Object.keys(state).length === 0
  if (stateIsEmpty) {
    // NEW handle after remount - run setup
    setupFn(state)
    setupHashes.set(hashKey, hash)
    return false
  } else {
    // OLD handle detecting change - trigger remount
    __hmr_clear_state(handle)
    stalenessForCurrentUpdate.add(hashKey)
    return true // Early return
  }
}
```

**3. Root Reconciliation:**

Added private root registry in component package (HMR never sees root objects):

```ts
// In refresh.ts (private)
let roots: VirtualRoot[] = []

// Roots auto-register on creation
export function registerRoot(root: VirtualRoot) {
  roots.push(root)
}

// HMR calls this (public API)
export function requestReconciliation() {
  roots.forEach((root) => root.reconcile())
}
```

**4. Registry Cleanup During Remount:**

Only delete component from registry if NOT currently being remounted:

```ts
let isBeingRemounted = stalenessForCurrentUpdate.has(stableKey)
if (componentEntry.handles.size === 0 && !isBeingRemounted) {
  // Safe to delete
}
```

## Files Modified

**Component Package:**

- `packages/component/src/lib/refresh.ts` - New staleness check infrastructure + private root registry
- `packages/component/src/dev.ts` - Public dev API exports
- `packages/component/src/lib/vdom.ts` - Staleness check before reusing handle + root registration
- `packages/component/package.json` - Added `./dev` export

**Dev Assets Middleware:**

- `packages/dev-assets-middleware/src/virtual/hmr-runtime.ts` - Complete rewrite of remount mechanism
- `packages/dev-assets-middleware/src/lib/hmr-transform.ts` - Updated `__hmr_setup` signature

## Test Results

✅ **All 307 tests passing:**

- 155 component tests (including 5 new refresh tests)
- 137 dev-assets-middleware unit tests
- 15 e2e HMR tests

✅ **All acceptance criteria met:**

- ✅ New Handle created with fresh signal (1:1 Handle:instance)
- ✅ New DOM element created (no reuse of old DOM nodes)
- ✅ Old Handle stays aborted (no mutation back to earlier state)
- ✅ Setup hash correctly tracked across remounts
- ✅ No infinite loops or "render after removed" warnings
- ✅ Demo app HMR works with setup scope changes

## Key Benefits

1. **Minimal API surface**: Single hook point (`setComponentStalenessCheck`) in component package
2. **Clean separation**: HMR layer on top, reconciler doesn't know about HMR
3. **Stable keys**: Uses `moduleUrl:componentName` for tracking across HMR updates
4. **State-based detection**: Uses empty state to distinguish old vs new handles
5. **Root reconciliation**: Triggers remount from root instead of individual handles
6. **No mutation**: Old handle stays aborted, new handle is fresh
7. **Clearer mental model**: Handle = component instance lifetime
