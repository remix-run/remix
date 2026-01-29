### Add HMR handle unregistration to prevent memory leaks

**Status:** ✅ **COMPLETE** - Fix implemented and tested

**Problem:**

The HMR runtime tracks component handles in `Set<Handle>` but never removes them when components unmount:

1. **Memory leaks** - unmounted handles remain in memory indefinitely
2. **Stale HMR updates** - HMR calls `handle.update()` on unmounted components

**Solution:**

Added abort signal listener in `__hmr_register` (`packages/dev-assets-middleware/src/virtual/hmr-runtime.ts`):

```typescript
handle.signal.addEventListener('abort', function () {
  // Remove handle from the component's handle set
  componentEntry.handles.delete(handle)

  // Clean up state storage
  __hmr_clear_state(handle)

  // Clean up handle metadata
  handleToComponent.delete(handle)

  // Clean up empty entries to prevent memory leaks
  if (componentEntry.handles.size === 0) {
    moduleComponents.delete(componentName)
    if (moduleComponents.size === 0) {
      components.delete(moduleUrl)
    }
  }
})
```

**Testing:**

Added testing API with `__hmr_*` prefix (exported functions, no globals):

- `export function __hmr_get_tracked_handle_count(moduleUrl, componentName): number`
- `export function __hmr_get_connection_status(): boolean`

Created e2e test (`hmr.playwright.ts` - "cleans up HMR registry when components unmount") using proper TDD:

1. Test initially failed: `1 !== 0` (confirmed memory leak)
2. After fix: **PASSES ✅**

**Results:**

All 144 tests pass (143 existing + 1 new)
