# dev-assets-middleware

Development middleware for serving and transforming JavaScript/TypeScript source files for use with [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router).

This middleware transforms TypeScript and JSX files on-demand, rewrites imports for browser compatibility, and serves files from `node_modules`. **This is for development only** - for production, use `@remix-run/assets-middleware` with a build manifest.

## Installation

```sh
npm install @remix-run/dev-assets-middleware esbuild
```

## Usage

```ts
import { createRouter } from '@remix-run/fetch-router'
import { devAssets } from '@remix-run/dev-assets-middleware'
import { staticFiles } from '@remix-run/static-middleware'

let router = createRouter({
  middleware: [
    devAssets('./app'), // JS/TS source files
    staticFiles('./public'), // Static files (CSS, images, etc.)
  ],
})
```

### How It Works

1. **Source files** (`.ts`, `.tsx`, `.js`, `.jsx`) are transformed with esbuild
2. **Imports are rewritten** - bare specifiers become `/@fs/...` URLs
3. **Files outside app root** are served from `/@fs/...` paths (when configured)

### Example

Given this source file at `app/entry.tsx`:

```tsx
import { component } from '@remix-run/component'
import { greet } from './utils.ts'

export let App = component(function App() {
  return () => <div>{greet('World')}</div>
})
```

The middleware serves it as JavaScript with imports rewritten:

```js
import { component } from '/@fs/node_modules/@remix-run/component/src/index.ts'
import { greet } from './utils.ts'

export let App = component(function App() {
  // ... transformed JSX
})
```

### Filesystem Access (`/@fs/`)

Files outside the app root (like `node_modules` or workspace packages) are served via `/@fs/` URLs. Configure the `fs` option to enable this:

```ts
devAssets('./app', {
  fs: {
    root: '../..',  // e.g., monorepo root
    allow: [/node_modules/, /^packages\//],
    deny: [/\.env/],
  },
})

## Features

- **On-demand transformation** - Files are transformed when requested
- **ESM native** - Leverages browser's native ES modules
- **esbuild powered** - Fast TypeScript and JSX transforms
- **Consistent resolution** - Uses esbuild's resolver for dev/prod parity

## Limitations

- **ESM only** - CommonJS packages are not supported (yet)
- **No CSS imports** - Use CSS-in-JS or `<link>` tags
- **No HMR** - Hot module replacement will be added separately

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`static-middleware`](https://github.com/remix-run/remix/tree/main/packages/static-middleware) - Middleware for serving static files

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
```
