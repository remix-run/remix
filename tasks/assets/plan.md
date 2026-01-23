# Assets Middleware Plan

This document captures the design decisions for Remix's assets/bundling strategy.

## Philosophy

- **Web standards first** - ESM native, no proprietary module formats
- **Simple by default** - Start with the simplest model that works, add complexity as opt-in
- **Dev/prod parity** - Use the same resolution logic in both environments
- **Minimal magic** - Explicit over implicit, avoid quirks around CSS injection, HMR edge cases, etc.

## Goals

1. Serve source files directly in dev
2. Transform TypeScript/JSX on demand
3. Handle node_modules imports without pre-bundling by default
4. Support production builds with esbuild
5. Keep HMR possible (but implement later)

---

## Package Structure

Two separate packages to avoid shipping dev dependencies to production:

- **`@remix-run/dev-assets-middleware`** - Dev middleware with on-demand transforms. Has heavy dependencies (esbuild, es-module-lexer, magic-string). Only used in development.

- **`@remix-run/assets-middleware`** - Prod middleware that serves built assets from a manifest. Lightweight, no transform dependencies. Used in production.

Both implement the same `Assets` interface (defined in fetch-router), so `context.assets.get()` works identically in dev and prod.

---

## Dev Model

**Serve source files directly, transform on first request.**

When a browser requests `/entry.tsx`:

1. Read `{root}/entry.tsx`
2. Transform with esbuild (TypeScript, JSX)
3. Rewrite imports (resolve paths, rewrite bare specifiers)
4. Return JavaScript with `Content-Type: application/javascript`

---

## URL Schemes

### Source Files (App Root)

Requests use **source file extensions** (`.ts`, `.tsx`, `.js`, `.jsx`).

```
Request: /entry.tsx
Maps to: {root}/entry.tsx
Returns: Transformed JavaScript
```

The root directory is stripped from URLs. If `root` is `./app`:

- `/entry.tsx` → `./app/entry.tsx`
- `/components/Button.tsx` → `./app/components/Button.tsx`

### Filesystem Access (`/@fs/`)

Files outside the app root are served via `/@fs/` URLs when the `fs` option is configured:

```typescript
devAssets('./app', {
  fs: {
    root: '../..', // e.g., monorepo root
    allow: [/node_modules/, /^packages\//],
    deny: [/\.env/],
  },
})
```

Bare specifier imports are rewritten to `/@fs/...` URLs:

```typescript
// Source
import { component } from '@remix-run/component'

// Transformed
import { component } from '/@fs/node_modules/@remix-run/component/src/index.ts'
```

The path after `/@fs/` is the real path relative to `fs.root`.

When the server receives a `/@fs/...` request:

1. Strip `/@fs/` prefix to get the path relative to `fs.root`
2. Check `allow`/`deny` patterns (deny takes precedence)
3. Read from `{fs.root}/{path}` (symlinks are followed automatically)
4. Transform and rewrite imports
5. Return JavaScript

### Handling Workspace Packages (Symlinks)

Workspace packages are symlinked in `node_modules/`. When resolving:

1. esbuild resolves `@remix-run/component/jsx-runtime` to real path: `/project/packages/component/src/jsx-runtime.ts`
2. Compute path relative to `fs.root`: `packages/component/src/jsx-runtime.ts`
3. Generate URL: `/@fs/packages/component/src/jsx-runtime.ts`

When serving:

1. Request: `/@fs/packages/component/src/jsx-runtime.ts`
2. Read: `{fs.root}/packages/component/src/jsx-runtime.ts`

The filesystem handles symlinks transparently.

### Security Model

The `/@fs/` scheme uses explicit allow/deny patterns for security:

1. **App root** - explicitly configured via `devAssets(root)`, you choose what to expose
2. **`/@fs/`** - scoped by `fs.allow` and `fs.deny` patterns, nothing allowed by default

This means:

- You can't request arbitrary files via `/@fs/` - only paths matching `allow` patterns
- `deny` patterns take precedence over `allow` for sensitive files (`.env`, secrets)
- Workspace packages work by allowing the `packages/` directory

---

## Resolution

### Same Resolver in Dev and Prod

**Critical**: Use esbuild's resolver in both dev and prod to ensure parity.

Resolution is done **at transform time**, and the resolved path is baked into the transformed code. This means:

- The server doesn't need to re-resolve on every request
- URLs are self-contained (no need to track importer context)
- The server is just a file server

### Resolution Cache

Cache resolution results for performance. Invalidate when:

- `node_modules` changes (new install)
- `package.json` changes

### What Gets Resolved

1. **Relative imports** - resolve and add file extension if missing

   ```typescript
   // Source
   import { foo } from './utils'
   // Transformed
   import { foo } from './utils.ts'
   ```

2. **Bare specifiers** - resolve to full path, rewrite to `/@fs/...`
   ```typescript
   // Source
   import { component } from '@remix-run/component'
   // Transformed
   import { component } from '/@fs/node_modules/@remix-run/component/src/index.ts'
   ```

### Resolution Config

Use consistent settings in dev and prod:

```typescript
let resolveConfig = {
  conditions: ['import', 'browser', 'default'],
  mainFields: ['browser', 'module', 'main'],
  // Match esbuild's defaults
}
```

---

## Import Parsing

### Use `es-module-lexer`

For robust import parsing, use **es-module-lexer** instead of regex:

- Battle-tested (used by Vite, esbuild, and many other tools)
- Handles all edge cases (strings containing `import`, comments, etc.)
- Very fast (native implementation)
- Returns precise positions for surgical string replacement

Use **MagicString** for efficient source manipulation:

- Preserves source map mappings
- Efficient for multiple small edits
- Standard tool for this use case

---

## Transforms

Use **esbuild** for transforms with these defaults:

```typescript
{
  loader: 'tsx', // or 'ts', 'jsx', 'js' based on extension
  jsx: 'automatic',
  jsxImportSource: '@remix-run/component',
  target: 'es2022',
  format: 'esm',
}
```

The `jsx: 'automatic'` and `jsxImportSource: '@remix-run/component'` are Remix defaults - no configuration needed.

### SWC for HMR (Future)

When HMR is added, SWC will be used for component-specific transforms (rewriting setup/render phases). esbuild handles the basic TypeScript/JSX transform, then SWC does the HMR-specific AST manipulation.

---

## Module Format

### ESM Only (Default)

Start with **ESM-only** support. If a package is CommonJS, error with a clear message.

This is on-brand for Remix's web standards focus and simplifies the implementation significantly (no CJS→ESM conversion).

### CJS Support (Future, Opt-in)

When CJS support is needed:

- Option 1: Pre-bundle CJS packages automatically
- Option 2: Explicit opt-in to pre-bundling for specific packages

Pre-bundling could be the on-ramp: "we serve ESM as-is, CJS requires pre-bundling."

---

## CSS

**No CSS imports in JavaScript.**

Bundler CSS handling can have many quirks:

- Wrapping CSS in JS that injects `<style>` tags
- HMR complexity
- SSR requires walking module graph to find CSS, generating inline styles, removing on hydration

We avoid all of this by:

- Using CSS-in-JS (Remix components)
- Manual `<link>` tags for external CSS
- Serving CSS via static-middleware

---

## Module Graph

The assets middleware should maintain a **module graph** tracking import relationships:

```typescript
interface ModuleNode {
  url: string // e.g. '/entry.tsx' or '/@fs/node_modules/pkg/index.js'
  file: string // Absolute file path
  importers: Set<ModuleNode> // Modules that import this one
  importedModules: Set<ModuleNode> // Modules this one imports
  transformResult?: TransformResult // Cached transform
  lastModified?: number // For cache invalidation
}
```

### Why We Need It

1. **HMR** - When a file changes, we need to know what imports it to propagate updates
2. **Cache invalidation** - Invalidate transform cache when dependencies change
3. **Debugging** - Understand the dependency tree

### Building the Graph

The graph is built incrementally as files are served:

1. When a file is requested, parse its imports
2. For each import, add an edge in the graph
3. When a file changes, walk `importers` to find affected modules

---

## HMR

HMR will be integrated into `dev-assets-middleware` rather than as a separate package.

**Why integrate?** Both dev-assets and HMR need the same knowledge:

- File structure on disk (root, fs config, allow/deny patterns)
- Module graph (import relationships)
- Change detection (file watching, mtime tracking)

Splitting these concerns creates duplicate code and config. One unified middleware with `hmr: true/false` is cleaner.

**Reference:** The `markdalgleish/hmr-spike` branch (commit `95a6162c8`) contains a working implementation.

**Key approach:**

- **State hoisting** - SWC transforms hoist component state to a WeakMap
- **Render proxy** - Components return a proxy that looks up the latest render function
- **Setup hash** - Detects when setup code changes (requires remount) vs render-only changes (state preserved)
- **Module graph** - Tracks imports to propagate changes to component boundaries
- **SSE** - Pushes updates to connected browsers

**API:**

```typescript
devAssets('./app', { hmr: true }) // enabled
devAssets('./app', { hmr: false }) // disabled for debugging
```

---

## Production Builds

Production uses esbuild to bundle, with the **same resolution config** as dev.

```typescript
await esbuild.build({
  entryPoints: ['./app/entry.tsx'],
  bundle: true,
  outdir: './build',
  // Same resolution settings as dev
  conditions: ['import', 'browser', 'default'],
  mainFields: ['browser', 'module', 'main'],
})
```

We still need to explore what the API for this would look like.

### Assets Manifest

Production builds use esbuild's metafile format (or a compatible subset). The middleware accepts this to map source entries to output files and their chunks.

```typescript
// Subset of esbuild's metafile that we use
interface AssetManifest {
  outputs: {
    [outputPath: string]: {
      entryPoint?: string
      imports?: Array<{ path: string; kind: 'import-statement' | 'dynamic-import' }>
    }
  }
}
```

This format captures:

- Which output files are entry points (have `entryPoint`)
- The import graph between chunks (for computing transitive dependencies)

Using a typed subset means:

- esbuild users can pass the metafile directly (it's a superset)
- Users with other bundlers can transform their output to match

### Assets API

The `assets` object is available on router context and provides a consistent API for dev and prod:

```typescript
// In a route handler
let entry = assets.get('app/entry.tsx')

entry.href // URL to the entry point
entry.chunks // All chunks needed (for module preloading)
```

**In dev mode** (no manifest):

```typescript
entry.href // '/entry.tsx' (1:1 mapping to source)
entry.chunks // ['/entry.tsx'] (no chunking in dev)
```

**In prod mode** (with manifest):

```typescript
entry.href // '/assets/entry-abc123.js'
entry.chunks // ['/assets/entry-abc123.js', '/assets/chunk-shared-def456.js', ...]
```

#### Chunk Resolution

`chunks` includes the entry's output file plus all **static imports** (transitive). Dynamic imports are excluded since they're intentionally lazy-loaded.

Example: if `entry.tsx` statically imports code that gets split into shared chunks:

```
entry.chunks = [
  '/assets/entry-abc123.js',      // The entry itself
  '/assets/chunk-shared-def456.js', // Shared code
  '/assets/chunk-utils-ghi789.js',  // Other shared utilities
]
```

This is typically used for module preloading:

```typescript
let entry = assets.get('app/entry.tsx')

let preloads = entry.chunks.map((href) => `<link rel="modulepreload" href="${href}">`).join('\n')

let script = `<script type="module" src="${entry.href}"></script>`
```

#### What's NOT Included

- **CSS chunks** - Not tracked. Handle CSS separately (CSS-in-JS, manual `<link>` tags, separate build).
- **Dynamic import chunks** - Excluded from `chunks` since they load on demand.
- **Convenience HTML helpers** - Just raw URLs. Build your own tags for full control over attributes.

---

## Middleware API

### Minimal API

```typescript
import { devAssets } from '@remix-run/dev-assets-middleware'

devAssets('./app')
```

That's it for simple projects. To serve files outside the app root (like `node_modules`), configure `fs`:

```typescript
devAssets('./app', {
  fs: {
    root: '../..', // monorepo root
    allow: [/node_modules/, /^packages\//],
    deny: [/\.env/],
  },
})
```

### What It Handles

- Requests for `.ts`, `.tsx`, `.js`, `.jsx` files under root
- `/@fs/...` requests for files outside root (when `fs` is configured)
- Transform, resolve, rewrite, serve

### What It Doesn't Handle

- CSS files (use static-middleware)
- Images, fonts, etc. (use static-middleware)
- HTML files (use static-middleware or route handlers)

### Composition

```typescript
let router = createRouter({
  middleware: [
    devAssets('./app', { fs: { root: '..', allow: [/node_modules/] } }),
    staticFiles('./public'), // Everything else
  ],
})
```

---

## Open Questions

1. **Pre-bundling strategy** - When we add it, is it automatic (detect CJS) or explicit (config)?

2. **HMR integration** - Built into assets middleware or separate composable middleware?

---

## Known Limitations

### Browser Field Object Form

The `browser` field in `package.json` has two forms:

1. **String form**: `"browser": "./dist/browser.js"` - ✅ Handled by esbuild
2. **Object form**: `"browser": { "./node.js": "./browser.js", "fs": false }` - ❌ Not handled

The object form is a remapping mechanism that esbuild doesn't automatically apply. Vite has explicit code to handle this. We may need to add support if we encounter packages that rely on it.

---

## Non-Goals (For Now)

- CSS imports/bundling
- Image optimization
- Code splitting (esbuild handles this in prod builds)
- Pre-bundling
- CJS support
- HMR

These can all be added incrementally.
