### Production build with assets manifest

Created the `@remix-run/assets-middleware` package for production asset resolution.

**What was done:**

- New `@remix-run/assets-middleware` package (lightweight, no transform deps)
- `AssetManifest` type compatible with esbuild's metafile format
- `assets(manifest)` middleware that sets `context.assets`
- `assets.get('app/entry.tsx')` returns `{ href, chunks }` with hashed output paths
- Transitive chunk resolution for modulepreload (excludes dynamic imports)
- Path normalization (handles `/`, `./` prefixes)
- 16 unit tests

**Demo integration:**

- `build.ts` script runs esbuild with `metafile: true`, outputs hashed files
- `server.ts` dynamically imports dev/prod middleware based on `NODE_ENV`
- Works in both dev mode (on-the-fly transforms) and prod mode (built assets)
- README documents `pnpm dev` vs `pnpm build && pnpm start`

**Key decisions:**

- Single `assets(manifest)` function (simplified from two-phase API)
- Dev root changed to `.` so paths match esbuild's entry points
- Used `staticFiles('.', { filter })` workaround for build directory (added `basePath` to todo)
