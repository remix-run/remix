# Assets Demo

A demonstration of the assets middleware packages for serving compiled/transformed assets in both development and production modes.

## Running the Demo

### Development Mode

Development mode transforms source scripts and file assets on-the-fly:

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

- [`server.ts`](server.ts) uses `@remix-run/dev-assets-middleware` in development for source transformation plus file variants, and `@remix-run/assets-middleware` in production for manifest-based resolution with static serving under `/assets`.
- [`build.ts`](build.ts) uses `@remix-run/assets` to build scripts/files and emit a local manifest consumed by the production middleware.
- [`app/entry.tsx`](app/entry.tsx) is the browser entry point that mounts the React component tree.
- [`app/components/App.tsx`](app/components/App.tsx) and [`app/components/Counter.tsx`](app/components/Counter.tsx) demonstrate `@remix-run/component` usage with setup functions and reactive updates.
