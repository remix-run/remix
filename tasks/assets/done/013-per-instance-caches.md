### Move caches to per-instance state

Module-level caches blocked parallel tests and prevented multiple middleware instances.

**Acceptance Criteria:**

- [x] `resolutionCache` and `packageRootCache` are created inside `assets()` closure
- [x] Helper functions receive caches via `Caches` parameter
- [x] Multiple `assets()` calls create independent cache instances
- [x] Existing functionality unchanged (demo still works)
