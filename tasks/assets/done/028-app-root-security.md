# App root security (allow/deny)

**The problem:**

When `devAssets('.')` is used to serve from the project root (for dev/prod path parity with esbuild entry points), any `.ts`/`.tsx`/`.js`/`.jsx` file in the project becomes servable. This could expose:

- `server.ts`, `build.ts` (server-side code)
- Config files with secrets
- Test files, scripts, etc.

Currently, `allow`/`deny` only exists on the `fs` option for `/@fs/` URLs. The main app root has no restrictions.

**Solution:**

Add `allow`/`deny` to the top level and restructure the API for consistency:

```typescript
devAssets({
  root: '.', // Optional, defaults to cwd
  allow: [/^app\//], // Required - whitelist app code
  deny: [/\.env/], // Optional - additional blocks (inherits to workspace)
  workspace: {
    root: '../..',
    allow: [/node_modules/, /^packages\//], // Required for workspace
    deny: [/\/test\//], // Optional - additional workspace blocks
  },
})
```

**Key design decisions:**

- **Single parameter API**: `root` moves into options object
- **Secure by default**: Nothing served without explicit `allow` patterns
- **Rename `fs` → `workspace`**: Clearer intent, maps to monorepo/pnpm workspace concepts
- **Rename URLs `/@fs/` → `/@workspace/`**: Consistency between config and URLs
- **Deny inheritance**: Top-level `deny` patterns apply globally; workspace can add more
- **Allow is root-specific**: Each root has its own `allow` (no inheritance—paths are root-specific)
- **Helpful error logging**: When requests blocked, log the path and suggest config pattern

**Acceptance Criteria:**

- [x] Update `DevAssetsOptions` interface with new structure
- [x] Implement allow/deny checks for main app root
- [x] Rename `/@fs/` → `/@workspace/` throughout codebase
- [x] Add error logging when requests are blocked (show path + suggested pattern)
- [x] Update demo to use new secure configuration
- [x] Add tests for allow/deny behavior on both roots
- [x] Update README, documentation and plan
- [x] Update existing tests that reference `/@fs/` or old API

**Implementation notes:**

- All 74 tests passing
- TypeScript compilation clean
- Demo server working with new secure configuration
- Console warnings updated to use `[dev-assets-middleware]` prefix
