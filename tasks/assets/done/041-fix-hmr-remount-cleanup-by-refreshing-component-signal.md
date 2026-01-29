## Fix HMR remount cleanup by refreshing component signal

**Problem:**

`requestRemount()` doesn't properly clean up resources from the old setup scope when the setup hash changes during HMR. The component's connected signal is never aborted, so cleanup listeners never fire.

**Example of the leak:**

```tsx
function Timer(handle: Handle) {
  // Setup scope - runs once
  let interval = setInterval(() => handle.update(), 1000)

  handle.signal.addEventListener('abort', () => {
    clearInterval(interval) // Cleanup - but never fires during HMR remount!
  })

  return () => <div>Tick</div>
}
```

When the setup scope changes during HMR:

1. `requestRemount()` clears `getContent` and calls `handle.update()`
2. Setup runs again, creating a NEW interval
3. Old interval is never cleared ❌
4. After N HMR updates, you have N intervals running simultaneously

**Solution:**

Abort the old signal and create a fresh one when remounting. This triggers all cleanup listeners and gives the component a fresh lifecycle.

**Current code:**

```typescript
// packages/component/src/lib/component.ts (line 285-287)
function reset() {
  getContent = null // Just clears render function
}

export function requestRemount(handle: Handle<any>): void {
  componentHandle.reset() // Missing signal cleanup!
  handle.update()
}
```

**Implementation:**

Rename `reset()` → `remount()` and add signal cleanup:

```typescript
function remount() {
  // Abort old signal to trigger cleanup
  if (connectedCtrl) connectedCtrl.abort()
  // Create fresh signal for new lifecycle
  connectedCtrl = new AbortController()
  // Clear render function to force setup re-run
  getContent = null
}
```

**Handle semantics after this change:**

- `Handle` object reference stays the same (HMR tracking works)
- `handle.signal` returns a fresh `AbortSignal` after remount (cleanup works)
- `handle.id` stays the same (HTML consistency)

**Acceptance Criteria:**

- [x] Rename `reset()` to `remount()` in `createComponent()`
- [x] Add signal abort + recreation to `remount()`
- [x] Update `requestRemount()` call site to use `remount()`
- [x] Update HMR runtime to skip cleanup during remount (check for new signal)
- [x] Extend HMR transform to extract ALL setup statements (not just variable declarations)
- [x] Create e2e test demonstrating cleanup during HMR remount
- [x] Add comprehensive unit tests for new transform behavior
- [x] Add comprehensive unit tests for `requestRemount` API
- [x] All tests pass (component: 150/150, dev-assets: 152/152, e2e: 15/15)

**Implementation Summary:**

1. **Component remount** (`component.ts`):

   - Renamed `reset()` → `remount()`
   - Added signal abort + recreation to trigger cleanup listeners
   - Order: create new signal first, clear render fn, then abort old signal

2. **HMR runtime** (`hmr-runtime.ts`):

   - Updated abort listener to distinguish remount from removal
   - Check `!handle.signal.aborted` to detect remount (new signal exists)
   - Only cleanup HMR tracking on actual removal

3. **HMR transform** (`hmr-transform.ts`):

   - Added `extractSetupStatements()` to extract ALL statements before return
   - Added `transformStatement()` to transform all statement types (not just variable declarations)
   - Updated `computeSetupHash()` to hash all setup statements
   - Now includes `addEventListener`, function calls, conditionals, etc. in setup function

4. **Tests**:
   - **E2E test**: Timer component verifying cleanup during HMR remount
   - **HMR transform unit tests** (6 tests):
     - addEventListener in setup
     - Function calls in setup
     - Conditional statements in setup
     - Expression statements in setup
     - Hash changes for non-variable statements
     - Multiple variable declarations in single statement
   - **`requestRemount` unit tests** (8 tests in `component.test.tsx`):
     - Triggers cleanup listeners when signal is aborted
     - Creates new signal after remount
     - Re-initializes setup scope on remount
     - Triggers update after remount
     - Warns when called with unknown handle
     - Handles multiple remounts correctly
     - Preserves component identity across remounts
     - Clears interval when signal is aborted during remount
