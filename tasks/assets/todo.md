# Assets Middleware - TODO

NOTE: Tasks that are in progress should be moved to `in-progress.md`.

## Features

### App root security (allow/deny)

**Status:** API design not finalized - needs further thought.

**The problem:**

When `devAssets('.')` is used to serve from the project root (for dev/prod path parity with esbuild entry points), any `.ts`/`.tsx`/`.js`/`.jsx` file in the project becomes servable. This could expose:

- `server.ts`, `build.ts` (server-side code)
- Config files with secrets
- Test files, scripts, etc.

Currently, `allow`/`deny` only exists on the `fs` option for `/@fs/` URLs. The main app root has no restrictions.

**Possible solutions:**

1. **Add `allow`/`deny` to main root** (symmetric with `fs`):

```typescript
devAssets('.', {
  allow: [/^app\//],  // Only serve from app/
  fs: { root: '../..', allow: [...] },
})
```

2. **Go back to scoped root** and adjust how `assets.get()` paths work:

```typescript
devAssets('./app') // Only app/ is servable
// assets.get('entry.tsx') instead of assets.get('app/entry.tsx')
```

3. **Default deny certain patterns** (fragile, not recommended)

**Open questions:**

- What's the most ergonomic API?
- Should there be sensible defaults (e.g., deny dotfiles, common config patterns)?
- How does this interact with the canonical URL redirects task?

**Acceptance Criteria:**

- [ ] Design finalized
- [ ] Implementation prevents serving sensitive files from app root
- [ ] Demo updated with secure configuration
- [ ] Documentation updated

---

### Canonical URL redirects for `/@fs/`

Ensure one URL per physical file by redirecting `/@fs/` requests to simpler URLs when the file's realpath is inside the project root.

**The problem:**

For example, if you're in a workspace package (`packages/web-app/`) with fs root set to the monorepo root, someone could request `/@fs/packages/web-app/utils/helper.js` - but that file is inside the project root, so it should be served at `/utils/helper.js` instead. Serving both URLs for the same file can cause duplicate module instances.

**The solution:**

- Canonical URL is determined by where the file's **realpath** lives
- Realpath inside project root → canonical is `/path/in/project` (no `/@fs/`)
- Realpath outside project root → canonical is `/@fs/path/from/fsroot`
- When serving `/@fs/` requests, check if realpath is in project root → redirect to canonical URL

**Benefits:**

- Simple projects with local `node_modules` don't need `fs` config at all
- Monorepos with symlinked workspace packages correctly use `/@fs/` (symlink realpath is outside project)
- No duplicate module instances regardless of how files are accessed

**Acceptance Criteria:**

- [ ] `/@fs/` requests redirect to `/...` URL when file's realpath is inside project root
- [ ] Symlinked files that resolve outside project root stay at `/@fs/` URLs (no redirect)
- [ ] Import rewriting generates canonical URLs (already works, just verify)
- [ ] Unit tests for redirect logic with symlink vs non-symlink cases
- [ ] Demo works without `fs` config when run in a standalone (non-monorepo) setup

---

### Improve ETag cache invalidation

**The problem:**

ETags are currently based on source file mtime/size. But the transformed output depends on more than just the source:

- Middleware transform logic (esbuild config, import rewriting rules)
- esbuild version
- Other dependencies

If transform logic changes but source files don't, the browser can serve stale cached transforms with outdated import paths (e.g., old `/@project/` URLs after renaming to `/@fs/`).

**Ideas to explore:**

- **Lockfile** - Changes when deps update. Could use mtime or content hash.
- **Middleware package (monorepo only)** - Auto-detect if we're in the Remix monorepo and factor in changes to `packages/dev-assets-middleware/`. This handles active middleware development.

Note: Directory mtime behavior varies by OS (may only update on add/remove, not content changes). May need to hash file list + mtimes, or find most recent file mtime recursively.

**Acceptance Criteria:**

- [ ] ETag invalidates when project dependencies change
- [ ] ETag invalidates when middleware package changes (when developing in monorepo)
- [ ] Solution is computed once at init, not per-request
- [ ] Unit tests for ETag generation with different scenarios

---

### External imports

Skip resolution for external URLs (e.g. `esm.sh`, `cdn.skypack.dev`, etc.).

This also unblocks import map support - if the browser has an import map that maps `lodash` to `https://esm.sh/lodash`, we need to leave bare specifiers alone so the browser can resolve them.

**Acceptance Criteria:**

- [ ] Imports starting with `http://` or `https://` are left unchanged
- [ ] Option to configure additional external patterns (e.g. `external: ['lodash', 'https://esm.sh']`)
- [ ] External bare specifiers are not rewritten to `/@fs/`
- [ ] Works for both static and dynamic imports

---

### Module graph with transform caching

Track import relationships between modules for HMR and caching. Cache transform results to avoid re-running esbuild on unchanged files.

**Note:** This will be unified with the HMR module graph (see below). Consider implementing together.

**Acceptance Criteria:**

- [ ] `ModuleNode` type with `url`, `file`, `importers`, `importedModules`, `transformResult`, `lastModified`
- [ ] Graph is built incrementally as files are served
- [ ] When a file is transformed, its imports are added to the graph
- [ ] `getModuleByUrl(url)` and `getModuleByFile(file)` lookups
- [ ] Transform results cached on module node, keyed by mtime
- [ ] Skip `esbuild.transform()` if mtime unchanged (cache hit)
- [ ] `invalidateModule(mod)` clears cache and propagates to importers

---

### Hot Module Replacement (HMR)

**Reference:** `markdalgleish/hmr-spike` branch (commit `95a6162c8`)

Integrate HMR into `dev-assets-middleware` rather than as a separate package. Both need the same knowledge (file structure, module graph, change detection), so splitting creates duplicate code and config.

**Prior art:** The HMR spike contains a working implementation with:

- `HMR-SPIKE.md` - Overview and implementation plan
- `packages/hmr-middleware/HMR-ARCHITECTURE.md` - Detailed architecture doc
- Working transforms, module graph, SSE, file watcher, and e2e tests

**Key approach (from spike):**

- **State hoisting** - SWC transforms hoist component state to a WeakMap so it survives module re-imports
- **Render proxy** - Components return a proxy that looks up the latest render function
- **Setup hash** - If setup code changes → remount (state lost); if only render changes → state preserved
- **Module graph** - Track imports to propagate changes to component boundaries
- **SSE** - Push updates to connected browsers

**Integration points:**

- Unified module graph (shared with transform caching)
- Shared file resolution and `fs` config
- File watcher feeds both HMR updates and cache invalidation
- SWC transform added to pipeline after esbuild

**API:**

```typescript
devAssets('./app', {
  fs: { ... },
  hmr: true,  // enabled by default? or opt-in?
})

devAssets('./app', { hmr: false })  // disable for debugging
```

**Acceptance Criteria:**

- [ ] Port HMR spike code into dev-assets-middleware
- [ ] Unified module graph (imports, timestamps, component boundaries)
- [ ] File watcher with change detection
- [ ] SSE endpoint for pushing updates
- [ ] SWC transform for component state hoisting
- [ ] HTML injection of HMR runtime
- [ ] `hmr` option to enable/disable
- [ ] Demo updated with working HMR
- [ ] E2e tests for HMR (port from spike)

---

### `basePath` option for static-middleware

**Package:** `@remix-run/static-middleware`

Add a `basePath` option to mount static files at a URL prefix, similar to Express's `app.use('/path', express.static(...))` pattern.

```ts
// Current workaround (serves from project root with filter)
staticFiles('.', { filter: (path) => path.startsWith('build/') })

// Desired API
staticFiles('./build', { basePath: '/build' })
```

**Acceptance Criteria:**

- [ ] `basePath` option strips the prefix before looking up files
- [ ] Request to `/build/entry.js` with `basePath: '/build'` serves `./build/entry.js`
- [ ] Requests not matching the basePath fall through to next middleware
- [ ] Works with other options (filter, index, listFiles, etc.)
- [ ] Unit tests for basePath matching and stripping
- [ ] Add change file for the new feature

---

## Testing

**Notes:**

- Future tasks should include tests as part of their acceptance criteria.
- Any new URL patterns must use browser-friendly URLs in source maps (not filesystem paths). Use `parseInlineSourceMap()` in unit tests to verify.

---

## Out of Scope (For Now)

These are explicitly not part of the initial spike:

- **CSS imports** - Use CSS-in-JS or manual `<link>` tags
- **CSS chunk tracking** - Not tracked in manifest, even in prod
- **Pre-bundling** - Future optimization for CJS packages or large dep trees
- **Multiple root directories** - Single root for now
