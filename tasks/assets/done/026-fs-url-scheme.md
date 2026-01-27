# Replace `/@node_modules/` with `/@fs/` URL scheme

**Problem:** The `/@node_modules/{packageName}/{path}` URL scheme assumed flat node_modules. Didn't work with pnpm workspaces where packages live in nested locations.

**Solution:** Replaced with `/@fs/` URLs using real paths relative to a configurable root:

- `/@fs/packages/interaction/src/index.ts`
- `/@fs/node_modules/@remix-run/component/src/index.ts`

**API:**

```typescript
devAssets('./app', {
  fs: {
    root: '../..',
    allow: [/node_modules/, /^packages\//],
    deny: [/\.env/],
  },
})
```

**Key changes:**

- `fs.root` defines the boundary for `/@fs/` URLs
- `fs.allow/deny` control what paths can be served (nothing by default)
- Removed `findInNodeModules()`, `nodeModulePaths` cache, and `packageRoot` cache
- URL scheme maps directly to config name (`fs` → `/@fs/`)
