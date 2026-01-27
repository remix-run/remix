# esbuild config support

Allow sharing the same esbuild config between prod builds and dev middleware for dev/prod parity.

**Motivation:**

- Users have custom esbuild config (plugins, target, resolution settings)
- Dev should match prod resolution and transforms
- Avoid config duplication

**API:**

```typescript
// Shared esbuild config
let esbuildConfig = {
  entryPoints: ['app/entry.tsx', 'app/admin.tsx'],
  target: 'es2022',
  jsx: 'automatic',
  jsxImportSource: '@remix-run/component',
  conditions: ['development', 'browser', 'import'],
  plugins: [mdxPlugin()],
  // ... any other BuildOptions
}

// build.ts (production)
esbuild.build({
  ...esbuildConfig,
  bundle: true,
  outdir: './build',
  metafile: true,
})

// server.ts (development)
devAssets('.', {
  esbuild: esbuildConfig, // Same config
  fs: { ... }
})
```

**Behavior:**

1. **Entry points restriction**

   - If `esbuild` config contains `entryPoints`, restrict `assets.get()` to only those entries
   - Return `null` for non-entry files (same as file-not-found behavior)
   - Without `esbuild` config, `assets.get()` works for any file (permissive, good for prototyping)
   - Natural progression: simple → production-ready without forced boilerplate

2. **Config handling**

   - Accept subset of `esbuild.BuildOptions` type (use `Omit<>` to exclude build-only options)
   - **Critical: Maintain unbundled dev architecture** - Transform one file at a time, don't follow imports
   - Override critical options to enforce unbundled model:
     ```typescript
     esbuild.build({
       ...userConfig,
       // Force these:
       stdin: { contents: source, sourcefile: filePath },
       bundle: false, // Keep unbundled - transform single file, don't follow imports
       write: false, // Return in memory, don't write to disk
       format: 'esm', // Always ESM
       sourcemap: userConfig.sourcemap === false ? false : 'inline', // Honor false, coerce everything else to inline
     })
     ```

3. **Switch from transform() to build() API**
   - Current: `esbuild.transform()` - no file context, requires manual loader config, no plugin support
   - New: `esbuild.build()` with `stdin` - file-aware, automatic loader inference, full plugin support
   - **Key requirement**: Must maintain unbundled, one-file-at-a-time transform model (no import following)

**Type definition:**

```typescript
export type DevAssetsEsbuildConfig = Omit<
  esbuild.BuildOptions,
  // Build-only options that are overridden/controlled by dev middleware
  | 'bundle' // Always false (unbundled dev)
  | 'splitting' // N/A without bundling
  | 'write' // Always false (in-memory)
  | 'metafile' // Not needed in dev
  | 'outdir' // Not writing to disk
  | 'outfile' // Not writing to disk
  | 'outbase' // Not writing to disk
  | 'outExtension' // Not writing to disk
  | 'format' // Always 'esm'
  | 'allowOverwrite' // Not writing to disk
  | 'stdin' // We control this internally
>
```

**What gets supported:**

✅ **Used (affects dev behavior)**:

- `entryPoints` - restricts `assets.get()`
- `target` - browser compatibility
- `jsx`, `jsxImportSource` - JSX transform
- `conditions`, `mainFields` - resolution
- `alias` - path aliases (though package.json `imports` field preferred)
- `plugins` - custom file types (MDX, GraphQL, etc.)
- `loader` - custom loaders per extension
- `sourcemap` - `false` honored, everything else coerced to `'inline'`

❌ **Ignored (overridden for dev)**:

- `bundle`, `splitting`, `write`, `metafile` - build-only
- `outdir`, `outfile`, `outbase`, `outExtension` - build-only (not writing to disk)
- `format` - always `'esm'`
- `allowOverwrite` - build-only
- `stdin` - controlled internally
- `sourcemap` external/both/linked modes - always inline (we don't serve external .map files)

**Acceptance Criteria:**

- [x] Define `DevAssetsEsbuildConfig` type using `Omit<esbuild.BuildOptions, ...>`
- [x] Accept `esbuild?: DevAssetsEsbuildConfig` option in `DevAssetsOptions`
- [x] Switch from `esbuild.transform()` to `esbuild.build()` with `stdin`
- [x] **Verify unbundled behavior**: Confirm only the single file is transformed, no imports are followed
- [x] Extract `entryPoints` from config and restrict `assets.get()` when provided (return `null` for non-entries)
- [x] Override critical options (bundle, write, format, stdin) to maintain unbundled dev model
- [x] Coerce sourcemap: `false` stays `false`, everything else becomes `'inline'`
- [x] Plugin support works (test with simple custom plugin, e.g., `.txt` file loader)
- [x] Automatic loader inference works (via `build()` API file context)
- [x] Demo updated to show shared config pattern (extract common config used by both build.ts and server.ts)
- [x] Document which options are used/ignored in README or JSDoc
- [x] Unit tests for entry points restriction (with and without entryPoints config)
- [x] Unit tests for config override behavior (verify bundle, write, format, sourcemap are forced correctly)
- [x] Unit tests for plugin support (custom .txt loader or similar)

## Implementation Notes

**Key decisions during implementation:**

1. **Switched from `Omit` to `Pick` with explicit whitelist** - More fail-safe approach where new esbuild options require explicit opt-in rather than potentially breaking dev mode. List is driven by `SUPPORTED_ESBUILD_OPTIONS` constant that serves as single source of truth for both TypeScript types and runtime filtering.

2. **Always use `entryPoints` instead of `stdin`** - Initial implementation used `stdin` for performance, but this prevented esbuild from finding and reading `tsconfig.json`. By using `entryPoints`, esbuild can automatically pick up `jsx: "react-jsx"` and `jsxImportSource` settings from tsconfig.

3. **Runtime filtering matches type definition** - Explicit loop over `SUPPORTED_ESBUILD_OPTIONS` ensures only whitelisted options are passed to esbuild, preventing build-specific options (minify, splitting, outdir) from affecting dev.

4. **Demo uses complete esbuild config** - `esbuild.config.ts` contains full production config (including minify, outdir, etc.) and is used directly by both build.ts and dev server. The dev middleware automatically filters to supported options.

**Files changed:**

- `packages/dev-assets-middleware/src/lib/assets.ts` - Added `SUPPORTED_ESBUILD_OPTIONS` constant, `DevAssetsEsbuildConfig` type, switched to `esbuild.build()` with `entryPoints`, runtime option filtering
- `packages/dev-assets-middleware/src/index.ts` - Export `DevAssetsEsbuildConfig` type
- `packages/dev-assets-middleware/src/lib/assets.test.ts` - Added tests for plugin support, config overrides, and entry points restriction
- `demos/assets-spike/esbuild.config.ts` - Created shared config
- `demos/assets-spike/build.ts` - Use shared config directly
- `demos/assets-spike/server.ts` - Pass shared config to devAssets middleware
