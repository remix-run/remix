# Refactor HMR component state storage to prevent prototype pollution

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

- [x] Replace plain object (`{}`) with `Object.create(null)` in `__hmr_state`
- [x] Create separate `setupHashes` WeakMap for HMR infrastructure
- [x] Update `__hmr_setup` to use `setupHashes` instead of `state.__setupHash`
- [x] Remove `__setupHash` from the state object type
- [x] Component state remains safe from prototype pollution (`__proto__`, `constructor`, etc. become regular properties)
- [x] Transform updated to remove unused `__s` parameter from `__hmr_setup` calls
- [x] All existing E2E tests pass (HMR behavior unchanged)
- [x] All unit tests pass
- [x] Update comments to clarify that component state persists across HMR updates

**What was implemented:**

The refactoring successfully separated HMR infrastructure (setup hash tracking) from component state:

1. **Runtime changes** (`hmr-runtime.ts`):

   - Changed `HmrState` interface to `ComponentState` and removed `__setupHash` property
   - Created separate `componentState` and `setupHashes` WeakMaps
   - Updated `__hmr_state()` to use `Object.create(null)` for prototype pollution safety
   - Updated `__hmr_setup()` to use `setupHashes` WeakMap and removed unused `state` parameter
   - Updated `__hmr_clear_state()` to clear both WeakMaps

2. **Transform changes** (`hmr-transform.ts`):

   - Removed `__s` parameter from generated `__hmr_setup()` calls (was unused after runtime refactor)
   - Transform now generates: `__hmr_setup(handle, 'HASH', setupFn)` instead of `__hmr_setup(handle, __s, 'HASH', setupFn)`

3. **Test updates** (`hmr-transform.test.ts`):
   - Updated all test expectations to match new function signature
   - Updated hash extraction regex patterns

The refactoring maintains full backwards compatibility for component behavior - state preservation works exactly as before, but with improved security and cleaner separation of concerns.
