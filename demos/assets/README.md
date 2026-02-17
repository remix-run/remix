# Assets Demo

A demonstration of the assets middleware packages for serving compiled/transformed assets in both development and production modes.

## Running the Demo

### Development Mode

Development mode transforms TypeScript files and images on-the-fly:

```bash
cd demos/assets
pnpm install
pnpm dev
```

Then visit http://localhost:44100

### Production Mode

Production mode serves pre-built and minified assets:

```bash
cd demos/assets
pnpm install
pnpm build
pnpm start
```

Then visit http://localhost:44100

## Code Highlights

- [`server.ts`](server.ts) uses `@remix-run/dev-assets-middleware` in development for on-the-fly TypeScript and image transformation, and `@remix-run/assets-middleware` in production with pre-built assets and a manifest.
- [`build.ts`](build.ts) uses esbuild to bundle the entry point, outputting hashed filenames and a metafile for the production manifest.
- [`app/entry.tsx`](app/entry.tsx) is the browser entry point that mounts the React component tree.
- [`app/components/App.tsx`](app/components/App.tsx) and [`app/components/Counter.tsx`](app/components/Counter.tsx) demonstrate `@remix-run/component` usage with setup functions and reactive updates.
