# Assets Middleware Demo

This demo showcases the assets middleware packages for serving JavaScript/TypeScript assets:

- **Development mode**: Uses `@remix-run/dev-assets-middleware` for on-the-fly TypeScript/JSX transformation
- **Production mode**: Uses `@remix-run/assets-middleware` with pre-built assets and a manifest

## Running the Demo

### Development Mode

Development mode transforms TypeScript/JSX files on-the-fly as they're requested:

```bash
pnpm run dev
```

Then open http://localhost:44100

In this mode:

- Source files in `app/` are served directly
- TypeScript/JSX is transformed on-the-fly with esbuild
- No build step required
- Changes are reflected on page refresh

### Production Mode

Production mode serves pre-built and minified assets:

```bash
# First, build the assets
pnpm run build

# Then start the server
pnpm run start
```

Then open http://localhost:44100

In this mode:

- Assets are bundled, minified, and content-hashed
- Optimal browser caching with hashed filenames
- All static imports are included in `chunks` for modulepreload
- Significantly faster page loads

## How It Works

### Development (`pnpm run dev`)

1. Server uses `devAssets()` middleware from `@remix-run/dev-assets-middleware`
2. When browser requests `/app/entry.tsx`, the middleware:
   - Reads the source file
   - Transforms it with esbuild (TypeScript → JavaScript, JSX → React)
   - Rewrites imports to browser-compatible paths
   - Returns the transformed code
3. `context.assets.get('app/entry.tsx')` returns `{ href: '/app/entry.tsx', chunks: ['/app/entry.tsx'] }`

### Production (`pnpm run build` + `pnpm run start`)

1. `build.ts` runs esbuild to bundle the entry point:
   - Outputs to `build/` with hashed filenames (e.g., `entry-ABC123.js`)
   - Generates `build/metafile.json` with import graph information
2. Server uses `assets()` middleware from `@remix-run/assets-middleware`
3. `context.assets.get('app/entry.tsx')` returns:
   - `href`: `/build/entry-ABC123.js` (hashed filename)
   - `chunks`: All static imports for modulepreload
4. Static middleware serves the built files from `build/`

## File Structure

```
demos/assets-spike/
├── app/                    # Source files
│   ├── entry.tsx           # Entry point
│   ├── components/         # React components
│   └── utils/              # Utilities
├── build/                  # Built assets (gitignored)
│   ├── entry-*.js          # Bundled entry
│   ├── chunk-*.js          # Code-split chunks
│   └── metafile.json       # Build manifest
├── public/                 # Static files (favicon, images)
├── build.ts                # Build script
├── server.ts               # Server (handles both modes)
└── package.json
```

## Scripts

| Script           | Description                                    |
| ---------------- | ---------------------------------------------- |
| `pnpm run dev`   | Start dev server with on-the-fly transforms    |
| `pnpm run build` | Build assets for production                    |
| `pnpm run start` | Start production server (requires build first) |
