# Assets Middleware - TODO

NOTE: Tasks that are in progress should be moved to `in-progress.md`.

## Assets package and CLI

---

### Add assets CLI with build command and use in assets + bookstore demos

**Dependencies:** Refactor dev-assets-middleware core to @remix-run/assets (above). This task assumes the assets package exists and exposes a programmatic build API.

**Context:** The assets package should be usable as a standalone build tool (including for non-Remix users). Add a built-in CLI with a `build` command (e.g. `remix-assets build`) and a programmatic `build()` API. Then switch the assets and bookstore demos to use this build instead of calling esbuild directly.

**Design: entries vs esbuild config.** We own the module graph, not esbuild—same as in dev. So **entries are a first-class build option** (e.g. `entryPoints: ['app/entry.tsx']`). We discover the full graph by walking from entries. **esbuild config** (target, jsx, tsconfig, plugins, loaders, define, external, etc.) is passed through for transforms. We run the same per-file esbuild build as dev—including plugins—so config can be shared between dev and prod. We do _not_ pass `entryPoints` to esbuild when we transform (we transform one file at a time); entries are only used by our build to decide which files to include. Options like `allow`/`deny` are dev-only (controlling what the dev server will serve dynamically). The build is static and driven entirely by the graph from entries.

**Output structure.** Mirror dev for simplicity: output contains literal `__@workspace/` and `node_modules/` directories (same path structure as dev). Option to **disable hashing in filenames** so prod output matches dev URLs and you get true dev/prod parity; when hashing is enabled, filenames get content hashes for cache-forever.

**Acceptance Criteria:**

- [ ] Programmatic API: `build({ entryPoints, root, outDir, esbuildConfig?, hashFilenames?, workspace?, manifest?, ... })` in `@remix-run/assets`. No `allow`/`deny`—build is graph-driven from entries. `esbuildConfig` = same supported options as dev-assets-middleware (including plugins; we run per-file esbuild build like dev). We don't pass `entryPoints` into esbuild when transforming. `manifest` = opt-in path for manifest output (e.g. `'./build/assets-manifest.json'` or `false` to skip).
- [ ] CLI: binary `remix-assets`, `build` subcommand accepting entry point(s) and options (e.g. `-o`, `--root`, `--esbuild-config`). No dedicated assets config file yet. `--esbuild-config` points at a file whose `export default` is either a config object or a function (async or sync) that returns the config. CLI calls the same programmatic API.
- [ ] Build implements the two-pass approach: pass 1 transform all in parallel (in memory), pass 2 topological rewrite + hash + write; file hashes include rewritten import URLs (cache-forever contract when hashing enabled)
- [ ] Output structure mirrors dev: literal `__@workspace/` and `node_modules/` directories in output; option (e.g. `hashFilenames: false`) to skip hashing so prod URLs match dev for parity
- [ ] Manifest is opt-in: configurable whether to emit one and where (e.g. `manifest: false` or `manifest: './build/assets-manifest.json'`). When emitted, format is compatible with `@remix-run/assets-middleware` (same shape as current metafile-based manifest).
- [ ] Assets demo supports both build modes: `pnpm build` (unbundled, assets build) and `pnpm build:bundled` (current esbuild-based). Prod serve works with either output (assets-middleware + appropriate manifest).
- [ ] Bookstore demo supports both build modes: `pnpm build` (unbundled, assets build) and `pnpm build:bundled` (current esbuild-based). Prod serve works with either output (assets-middleware + appropriate manifest).
- [ ] All tests and static checks pass; both demos work in dev (unchanged) and in prod (new build pipeline)

---

## Features

---

### Add default deny patterns for security

Automatically deny serving common sensitive files, even if they match `allow` patterns. This provides a safety net to prevent accidental exposure of secrets.

**Problem:**

Currently, users must explicitly configure `deny` patterns to block sensitive files. If someone writes `allow: ['**']` or forgets to exclude secrets, they could accidentally expose:

- Environment variables (`.env` files)
- Private keys and certificates
- Other sensitive configuration

**Proposed solution:**

Add a `DEFAULT_DENY` list that's always applied, regardless of `allow` patterns:

```typescript
const DEFAULT_DENY = [
  '**/.env',
  '**/.env.*',
  '**/*.pem',
  '**/*.key',
  '**/*.crt',
  // Additional patterns as needed
]

// In isPathAllowed():
// 1. Check DEFAULT_DENY first (always block)
// 2. Check user deny patterns
// 3. Check allow patterns
```

**Benefits:**

- **Safety by default** - Common secrets are blocked even with permissive `allow` patterns
- **Defense in depth** - Even if users misconfigure, sensitive files stay protected
- **Clear messaging** - Can log helpful warnings when default denies are triggered
- **Still overridable** - Users can explicitly add patterns to `allow` if absolutely needed (though we should warn)

**Acceptance Criteria:**

- [ ] Add `DEFAULT_DENY` constant with common sensitive file patterns
- [ ] Apply default deny before user-configured deny patterns
- [ ] Default deny takes precedence over allow patterns
- [ ] Log a clear warning when default deny blocks a file (helps debugging)
- [ ] Document the default deny list in README/JSDoc
- [ ] Add tests verifying default deny works even with `allow: ['**']`
- [ ] Update examples to show users don't need to specify these patterns
- [ ] All tests pass

---

### Compose source maps for import rewrite (dev)

**Not a blocker.** Improves devtools accuracy when import paths are rewritten.

**The issue:**

In dev we do two transforms in sequence: (1) esbuild turns TS into JS and emits a source map (esbuild output → original TS), then (2) we rewrite import specifiers in that JS (e.g. `'./utils'` → `'/app/utils.ts'`). The code we actually serve is the result of step 2, but we only attach the step 1 map. So the map describes the _intermediate_ code (after esbuild, before rewrite), not the _final_ code. Character positions can be wrong where we changed imports—e.g. "open in editor" or column highlights in devtools may be slightly off on or near rewritten import lines.

**Success looks like:**

- The inline source map we attach to the response maps the **final** served code (after import rewrite) back to the original TypeScript.
- In devtools, clicking a line or viewing the source map shows correct file/line/column for the code the browser is actually running.
- Composing is done by properly merging the rewrite map (final code → esbuild output) with the esbuild map (esbuild output → TS), e.g. using the `source-map` library or equivalent.

**Acceptance criteria:**

- [ ] When `rewriteImports` changes the code, we produce a single source map that maps final code → original TS (e.g. by composing MagicString’s map with the esbuild map).
- [ ] When there are no rewrite changes, we still return the esbuild map as today.
- [ ] Existing tests pass; optional: add a test that asserts a composed map’s mappings for a rewritten-import line point at the correct TS source.

---

### Add custom logger option

The middleware currently uses `console.warn/log/error` for all logging, which creates noise during tests and doesn't integrate with application logging infrastructure.

**Current problems:**

- Security warnings (`Blocked: ...`) spam test output (22+ console calls in `assets.ts`)
- No way to silence or redirect logs during tests
- Can't integrate with application logging systems (winston, pino, etc.)
- Debug logs controlled by environment variable (`DEBUG=assets`) rather than configuration

**Examples of noisy output during tests:**

```
[dev-assets-middleware] Blocked: /__@workspace/packages/lib/index.ts
  No allow pattern matched. Current patterns:
    /node_modules/
  Consider adding: workspace: { allow: [/packages\//] }
```

**Proposed solution:**

Add optional `logger` configuration to `DevAssetsOptions`:

```typescript
interface Logger {
  debug: (message: string, ...args: any[]) => void
  info: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
}

interface DevAssetsOptions {
  // ... existing options
  logger?: Logger // Defaults to console
}
```

**Benefits:**

- Tests can pass silent logger: `logger: { debug() {}, info() {}, warn() {}, error() {} }`
- Production apps can use their logging infrastructure
- Consistent logging interface
- Better control over log levels

**Acceptance Criteria:**

- [ ] Add `Logger` interface to `DevAssetsOptions`
- [ ] Replace all `console.*` calls with `logger.*` calls
- [ ] Default logger uses `console` (no breaking changes)
- [ ] Update E2E tests to use silent logger (cleaner test output)
- [ ] Document logger option in README/JSDoc
- [ ] All tests pass

---

### Canonical URL redirects for `/__@workspace/`

Ensure one URL per physical file by redirecting `/__@workspace/` requests to simpler URLs when the file's realpath is inside the project root.

**The problem:**

For example, if you're in a workspace package (`packages/web-app/`) with workspace root set to the monorepo root, someone could request `/__@workspace/packages/web-app/utils/helper.js` - but that file is inside the project root, so it should be served at `/utils/helper.js` instead. Serving both URLs for the same file can cause duplicate module instances.

**The solution:**

- Canonical URL is determined by where the file's **realpath** lives
- Realpath inside project root → canonical is `/path/in/project` (no `/__@workspace/`)
- Realpath outside project root → canonical is `/__@workspace/path/from/workspace-root`
- When serving `/__@workspace/` requests, check if realpath is in project root → redirect to canonical URL

**Benefits:**

- Simple projects with local `node_modules` don't need `workspace` config at all
- Monorepos with symlinked workspace packages correctly use `/__@workspace/` (symlink realpath is outside project)
- No duplicate module instances regardless of how files are accessed

**Acceptance Criteria:**

- [ ] `/__@workspace/` requests redirect to `/...` URL when file's realpath is inside project root
- [ ] Symlinked files that resolve outside project root stay at `/__@workspace/` URLs (no redirect)
- [ ] **Source maps use canonical URLs** - The `sourceUrl` passed to `transformSource()` and `fixSourceMapPaths()` must be the canonical URL (after redirect), ensuring compiled files and their sources are always in sync in browser DevTools
- [ ] Import rewriting generates canonical URLs (already works, just verify)
- [ ] Unit tests for redirect logic with symlink vs non-symlink cases
- [ ] Unit tests verify source maps contain canonical URLs using `parseInlineSourceMap()`
- [ ] Demo works without `workspace` config when run in a standalone (non-monorepo) setup

---

### Pre-emptive import transforms (eliminate waterfalls)

**Dependencies:** Module graph task (above)

When transforming a file, proactively transform its immediate imports in the background. This eliminates request waterfalls where the browser must wait for each level of imports sequentially.

**Current behavior (waterfall):**

```
Browser requests /entry.tsx
  → Server transforms (200ms)
  → Browser parses, sees import './utils.ts'
    → Browser requests /utils.ts
      → Server transforms (50ms)
```

**With pre-emptive transforms:**

```
Browser requests /entry.tsx
  → Server transforms entry.tsx
  → Kicks off background transform for ./utils.ts
  → Returns entry.tsx (200ms)
Browser requests /utils.ts
  → Already in cache ✨
  → Instant response
```

**Strategy:**

1. **One level deep only** - Only transform immediate static imports, not transitive
2. **Don't block response** - Kick off background transforms, return immediately
3. **Natural cascade** - Each transform warms its own imports, creates chain reaction
4. **Error handling** - Log errors but don't throw (let browser see error when it requests)

**Why one level?**

- Avoids server spinning on deep import trees
- Most benefit for least work (first hop is most expensive)
- Predictable resource usage

**Error handling:**

```typescript
async warmupRequest(url: string): Promise<void> {
  try {
    await transformRequest(url)
  } catch (error) {
    // Log but don't throw - let browser see real error on request
    logger.warn(`Pre-transform error for ${url}: ${error.message}`)
  }
}
```

**Acceptance Criteria:**

- [ ] After transforming a file, extract static imports
- [ ] Kick off background transforms for immediate imports only (one level)
- [ ] Don't wait for background transforms to complete before returning response
- [ ] Log pre-transform errors but don't throw
- [ ] Performance metrics show reduced waterfall depth
- [ ] Works with module graph caching (doesn't re-transform unnecessarily)

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
