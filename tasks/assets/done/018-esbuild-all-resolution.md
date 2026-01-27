### Use esbuild for ALL import resolution

Consolidated all import resolution through esbuild to ensure dev/prod parity and plugin compatibility.

**Acceptance Criteria:**

- [x] Remove custom `resolveRelativeImport()` function
- [x] Batch ALL specifiers (relative + bare) through esbuild
- [x] Output absolute URLs for app files (e.g., `/components/Counter.tsx`)
- [x] Output `/@node_modules/` URLs for packages
- [x] Handle TypeScript extensionless imports via esbuild
- [x] Handle symlink resolution (macOS `/var` → `/private/var`)
- [x] E2E tests pass
- [x] Demo app still works
