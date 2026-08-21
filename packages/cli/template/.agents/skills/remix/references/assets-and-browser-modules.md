# Assets and Browser Modules

## What This Covers

How to serve browser scripts and styles from source. Read this when the task involves:

- Configuring `createAssetServer` (`basePath`, `fileMap`, `allowFiles`, `allowPackages`, `denyFiles`, fingerprinting, compiler options)
- Choosing between `staticFiles()` for already-built files and `createAssetServer()` for source assets that need import rewriting, preloads, or fingerprinted URLs
- Generating script URLs or `<link rel="modulepreload">` tags for a client entry
- Enabling browser HMR for source-served modules
- Keeping files such as tests out of the browser via `denyFiles` rules

For routing the URL namespace itself, see `routing-and-controllers.md`. For client entry hydration and browser update handling, see `hydration-frames-navigation.md`. For the Node HMR runner and browser HMR channel, see `middleware-and-server.md`.

## When To Reach For It

Use `remix/assets` when the app serves browser JavaScript, TypeScript, or CSS from source files. This is the right tool for client entrypoints, browser-only helpers, styles, and monorepo code that should be compiled and served under a public URL namespace.

Use `staticFiles()` for files that already exist on disk exactly as they should be served. Use `createAssetServer()` for source scripts or styles that need rewriting, dependency scanning, preloads, sourcemaps, or fingerprinted URLs.

## Default Pattern

```typescript
import { createAssetServer } from 'remix/assets'
import { createController } from 'remix/router'
import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
})

let assetServer = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
  },
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.test.*'],
  target: { es: '2020', chrome: '109', safari: '16.4' },
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  minify: process.env.NODE_ENV === 'production',
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})

export default createController(routes, {
  actions: {
    async assets({ request }) {
      return (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 })
    },
  },
})
```

## Rules

- Treat `allowFiles`/`allowPackages` and `denyFiles` as the security boundary for browser-reachable source files.
- Put browser-reachable app source in a `public/` directory inside `app/`, beside its narrowest owner, such as `app/ui/public/` or `app/actions/cart/public/`.
- Every local dependency in a browser module graph must match `allowFiles`, so keep the whole graph inside those `public/` directories. `app/routes.ts` is allowed separately so browser modules can build type-safe links with `routes.*.href(...)`.
- Deny test modules with `denyFiles` so tests can be colocated inside a `public/` directory without becoming browser-reachable.
- Use `allowFiles` and `denyFiles` for file paths and globs. Relative values resolve from `rootDir`.
- Use `allowPackages` for exact package names, not globs or subpaths. Packages allowed by `allowPackages` also allow their installed `dependencies` and `optionalDependencies`; peer dependencies must be listed explicitly if they should be browser-reachable.
- `denyFiles` takes precedence over both file and package allow rules.
- Set `rootDir` explicitly in monorepos so relative paths resolve from the intended project root.
- `basePath` is the public URL namespace handled by the asset server.
- `fileMap` keys are URL patterns relative to `basePath`, and values are root-relative file path patterns. They use `route-pattern` syntax on both sides.
- Keep the same wildcard params on both sides of a `fileMap` entry so import rewriting can map source files back to public URLs.
- CSS files are compiled and served alongside scripts. Local CSS `@import` rules are rewritten and fingerprinted with the same asset server routing rules.

## Rendering HTML

Use `getHref()` when you need the public URL for one module, and `getPreloads()` when you want `<link rel="modulepreload">` tags or `Link` headers for one or more entrypoints and their dependencies.

```typescript
let entryHref = await assetServer.getHref('app/actions/public/entry.ts')
let entryPreloads = await assetServer.getPreloads('app/actions/public/entry.ts')
```

Use this when rendering documents or layouts that boot browser behavior with a known client entry.

When resolving hydrated client entries during server rendering, pass the source entry ID from `clientEntry(import.meta.url, ...)` to `getHref()` and `getPreloads()` inside `resolveClientEntry`. Return those preload hrefs through the entry's `preloads` property so the browser can fetch the module graph without walking it serially. Keep this resolution in the shared render helper rather than hard-coding public asset URLs in source-owned component modules.

## Development vs Deployment

In development:

- Keep `watch` enabled so source changes are picked up without restarting the server
- Prefer stable URLs with normal revalidation
- Enable source maps when debugging browser code
- Use `hmr` only when the app is running under `remix/node-hmr`
- Use `scripts.loaders` for development-only browser transforms such as `uiHmr()`

In deployment:

- Set `watch: false`
- Use `fingerprint: { buildId }` for long-lived immutable caching
- Make sure `buildId` changes for each deploy

Fingerprinting assumes files on disk are stable and requires `watch: false`.

## Browser HMR

Use browser HMR when source-served browser modules should update without a full page reload during development. Let `remix/node-hmr` own the browser HMR channel so browser updates stay coordinated with server restarts.

```typescript
import { createAssetServer } from 'remix/assets'
import { uiHmr } from 'remix/ui-hmr/assets'

const isDevelopment = process.env.NODE_ENV === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

const assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  denyFiles: ['app/**/*.test.*'],
  watch: isDevelopment,
  hmr: isHmr
    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
    : undefined,
  scripts: {
    loaders: isHmr ? [uiHmr()] : undefined,
  },
})
```

Rules:

- Guard `remix/node-hmr/runtime` imports with `process.env.REMIX_NODE_HMR`; that runtime API is only available inside the supervised child process.
- Keep browser HMR and loaders development-only.
- Add `remix/assets/types/hmr` to `compilerOptions.types` only when browser source modules use `import.meta.hot` directly.
- Write HMR accept calls directly as `import.meta.hot.accept(...)` with literal dependency specifiers.

## Useful Compiler Options

- `minify` for production minification of scripts and styles
- `sourceMaps` for `'external'` or `'inline'` source maps for scripts and styles
- `sourceMapSourcePaths` for `'url'` or `'absolute'` source map paths
- `target` as an object for shared browser targets and script-only ECMAScript output, such as `{ es: '2020', chrome: '109', safari: '16.4' }`
- `scripts.define` to replace globals such as `process.env.NODE_ENV`
- `scripts.external` to leave specific script imports untouched
- `scripts.loaders` to transform browser modules during compilation

Do not nest shared compiler options under `scripts`. Use top-level `minify`, `sourceMaps`, `sourceMapSourcePaths`, and `target` so they apply to styles as well as scripts.

## Lifecycle

If the asset server is long-lived and watching the file system, call `await assetServer.close()` when shutting down dev servers or disposing tests.
