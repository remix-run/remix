### Remove hardcoded packages/ assumption

`findInNodeModules()` previously scanned `packages/` directory which was monorepo-specific and inefficient.

**Solution:**

- Cache URL → absolute path mapping in `resolvedPathToUrl()` when generating `/@node_modules/` URLs
- Use cached path in `handleNodeModulesRequest()` before falling back to standard node_modules lookup
- Remove `packages/` directory scan from `findInNodeModules()`

This approach works because:

1. When esbuild resolves imports, it follows symlinks correctly
2. `resolvedPathToUrl()` gets the resolved absolute path and caches it with the URL
3. When the browser requests that URL, we use the cached path directly
4. `findInNodeModules()` is only a fallback for direct requests that weren't generated through import rewriting

**Acceptance Criteria:**

- [x] Remove `packages/` directory scan from `findInNodeModules()`
- [x] Verify workspace packages still resolve (via pnpm symlinks)
- [x] If workspace resolution breaks, find a better solution (URL→path caching)
