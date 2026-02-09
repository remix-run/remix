# In Progress Tasks

---

### Add assets build (JS API) and use in assets + bookstore demos

**Dependencies:** Refactor dev-assets-middleware core to @remix-run/assets (above). This task assumes the assets package exists and exposes a programmatic build API.

**Context:** The assets package is usable as a standalone build tool (including for non-Remix users) via the programmatic `build()` API. The assets and bookstore demos use this build (e.g. from a `build.ts` script) instead of calling esbuild directly. CLI is deferred until there is a clear strategy for the overall Remix CLI.

**Design: entries vs esbuild config.** We own the module graph, not esbuild—same as in dev. So **entries are a first-class build option** (e.g. `entryPoints: ['app/entry.tsx']`). We discover the full graph by walking from entries. **esbuild config** (target, jsx, tsconfig, plugins, loaders, define, external, etc.) is passed through for transforms. We run the same per-file esbuild build as dev—including plugins—so config can be shared between dev and prod. We do _not_ pass `entryPoints` to esbuild when we transform (we transform one file at a time); entries are only used by our build to decide which files to include. Options like `allow`/`deny` are dev-only (controlling what the dev server will serve dynamically). The build is static and driven entirely by the graph from entries.

**Output structure.** Mirror dev for simplicity: output contains literal `__@workspace/` and `node_modules/` directories (same path structure as dev). Output filenames are controlled by a **path template** (`fileNames`) with placeholders: `[dir]` (path directory of the module, no trailing slash), `[name]` (base name), `[hash]` (content hash, 8 chars). Extension `.js` is always appended. Default template is `'[name]-[hash]'`. To get dev/prod URL parity (no hashing), use a template without `[hash]` (e.g. `'[name]'` or `'[dir]/[name]'`). Behavior matches esbuild’s `[dir]` (no trailing slash; slash goes in the template, e.g. `[dir]/[name]-[hash]`).

**Acceptance Criteria:**

- [x] Programmatic API: `build({ entryPoints, root, outDir, esbuildConfig?, fileNames?, workspace?, manifest?, ... })` in `@remix-run/assets`. No `allow`/`deny`—build is graph-driven from entries. `esbuildConfig` = same supported options as dev-assets-middleware (including plugins; we run per-file esbuild build like dev). We don't pass `entryPoints` into esbuild when transforming. `fileNames` = path template with placeholders `[dir]`, `[name]`, `[hash]` (default `'[name]-[hash]'`); `.js` is always appended; hash is only computed when template contains `[hash]`. `manifest` = path to emit manifest (e.g. `'./build/assets-manifest.json'`) or `false` to skip; omit/undefined = no manifest.
- [x] ~~CLI~~ (deferred): Build is JS API only; demos invoke `build()` from a script (e.g. `tsx build.ts`).
- [x] Build implements the two-pass approach: pass 1 transform all in parallel (in memory), pass 2 topological rewrite + hash (when template has `[hash]`) + write; file hashes include rewritten import URLs (cache-forever when hashing).
- [x] Output structure mirrors dev: literal `__@workspace/` and `node_modules/` in output; filename pattern via `fileNames` (e.g. `'[name]'` or `'[dir]/[name]'` for no hash = prod URLs match dev).
- [x] Manifest is opt-in: `manifest: false` or path (e.g. `'./build/assets-manifest.json'`). When emitted, format is compatible with `@remix-run/assets-middleware` (same shape as current metafile-based manifest).
- [x] Assets demo: `pnpm build` (unbundled, assets build) and `pnpm build:bundled` (esbuild-based). Prod serve works with either (assets-middleware + manifest). Demo uses `fileNames: '[dir]/[name]-[hash]'`.
- [x] Bookstore demo: same dual build and prod serve. Uses `fileNames: '[dir]/[name]-[hash]'`.
- [x] All tests and static checks pass; both demos work in dev and prod with the new build pipeline.

**Implementation status:**

- [x] Programmatic API and two-pass build
- [x] `fileNames` template with `[dir]` / `[name]` / `[hash]` (replaces previous hashFilenames boolean)
- [x] Programmatic build with `fileNames` template (no CLI)
- [x] Manifest format and emit
- [x] Assets demo dual build + prod serve
- [x] Bookstore demo dual build + prod serve
- [x] Manual testing with curl
