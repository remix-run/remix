# Scripts Simplification Plan

## Background

The `@remix-run/script-handler` package currently has a client/server split:

- **`createScriptsRoute`** (importable from `@remix-run/script-handler/routes`) — client-safe, holds the base path and entry point patterns, provides `href()`
- **`createScriptHandler`** (importable from `@remix-run/script-handler`) — server-only, takes a `ScriptsRoute` + server options, provides `handler()` and `preloads()`

`createScriptsRoute` exists for two reasons: to provide a client-safe `href()` for generating entry point URLs, and to carry `entryPoints` to the handler. Neither reason survives scrutiny:

- **`href()`** — scripts are just routes. URL generation belongs to the standard route pattern mechanism, same as every other route. No special `href()` needed.
- **`entryPoints` as a route concern** — entry points are purely handler configuration: a security/access control list that says "only these paths can be served without a content hash." That belongs in `createScriptHandler`, not a separate route definition. It's no different from `staticFiles('./public')` scoping itself to a directory.
- **`basePath`** — a router concern. The handler doesn't need to know where it's mounted. The router passes the matched path directly; the handler derives any needed base from the request URL at runtime.
- **`typed-glob`** — only used to validate `href()` call sites at compile time. With `href()` gone, the entire dependency goes with it.

**Scripts are just routes.** They belong in the main route tree alongside `/books`, `/cart`, etc., configured and mounted like any other handler.

---

## Proposed changes

### Before

```ts
// routes.ts (client-safe, separate file)
export const scripts = createScriptsRoute('/scripts', {
  entryPoints: ['app/entry.tsx', 'app/worker.ts'] as const,
})

// server.ts
let scriptsHandler = createScriptHandler(scripts, {
  root,
  workspaceRoot: '../..',
})

// Mounted as middleware (not a real route)
let scriptsMiddleware: Middleware = async ({ request }, next) => {
  let response = await scriptsHandler.handler(request)
  return response ?? next()
}

// Href via special scripts.href()
scripts.href('app/entry.tsx') // → '/scripts/app/entry.tsx'
```

### After

```ts
// app/routes.ts — scripts is just another route
export let routes = {
  // ...
  scripts: '/scripts/*path',
}

// app/router.ts — configured and mounted like any other handler
let scripts = createScriptHandler({
  entryPoints: ['app/entry.tsx', 'app/worker.ts'],
  root,
  workspaceRoot: '../..',
})

router.get(routes.scripts, ({ request, params }) => scripts.handle(request, params.path))

// Href via standard route pattern — same as any other route
routes.scripts.href({ path: 'app/entry.tsx' }) // → '/scripts/app/entry.tsx'
```

### What's deleted

- `createScriptsRoute` — entirely removed
- `src/lib/scripts-route.ts` and `src/routes.ts` — deleted
- `src/lib/typed-glob/` — deleted
- `./routes` package export — removed from `packages/remix/package.json`
- `ScriptsRoute`, `ScriptsRouteOptions` types — removed

---

## Updated handler interface

```ts
interface ScriptsHandler {
  /** Handle a request for a script module. `path` is the already-matched module path from the router. */
  handle(request: Request, path: string): Promise<Response | null>
  /** Module preload URLs for a given entry point, ordered shallowest-first */
  preloads(entryPoint: string): Promise<string[]>
}

function createScriptHandler(options: {
  entryPoints: readonly string[]
  root: string
  sourceMaps?: boolean
  external?: string | string[]
  workspaceRoot?: string
}): ScriptsHandler
```

No `basePath`, no `href()`. The router owns URL dispatch; the handler owns compilation.

---

## Update `demos/assets-reboot`

### Before

```ts
// routes.ts
export const scripts = createScriptsRoute('/scripts', {
  entryPoints: ['app/entry.tsx', 'app/worker.ts'] as const,
})

// server.ts
import { scripts } from './routes.ts'
let scriptsHandler = createScriptHandler(scripts, {
  root: import.meta.dirname,
  workspaceRoot: '../..',
})
```

### After

```ts
// server.ts — routes.ts deleted entirely
let scripts = createScriptHandler({
  entryPoints: ['app/entry.tsx', 'app/worker.ts'],
  root: import.meta.dirname,
  workspaceRoot: '../..',
})

router.get('/scripts/*path', ({ request, params }) => scripts.handle(request, params.path))

// Href is just the route pattern
let entryHref = '/scripts/app/entry.tsx'
```

---

## Update `demos/bookstore`

### Before

```ts
// asset-routes.ts
export let scripts = createScriptsRoute('/scripts', {
  entryPoints: ['app/entry.tsx', 'app/assets/*.tsx'] as const,
})

// app/router.ts
import { scripts } from '../asset-routes.ts'
let scriptsHandler = createScriptHandler(scripts, { root, workspaceRoot: '../..' })

// app/utils/assets.ts
import { scripts } from '../../asset-routes.ts'
export function getScriptsEntry() {
  return {
    href: context.storage.get(scriptsEntryHrefKey) ?? scripts.href('app/entry.tsx'),
    preloads: context.storage.get(scriptsPreloadsKey) ?? [],
  }
}
```

### After

```ts
// asset-routes.ts — deleted entirely (also removed by FILE-CACHE-PLAN.md)

// app/routes.ts — scripts joins the main route tree
export let routes = {
  // ... existing routes unchanged ...
  scripts: '/scripts/*path',
}

// app/router.ts — configured and mounted like any other handler
let scripts = createScriptHandler({
  entryPoints: ['app/entry.tsx', 'app/assets/*.tsx'],
  root,
  workspaceRoot: '../..',
})

router.get(routes.scripts, ({ request, params }) => scripts.handle(request, params.path))

// app/utils/assets.ts — href from standard route pattern, no special import needed
export function getScriptsEntry() {
  return {
    href:
      context.storage.get(scriptsEntryHrefKey) ?? routes.scripts.href({ path: 'app/entry.tsx' }),
    preloads: context.storage.get(scriptsPreloadsKey) ?? [],
  }
}
```

---

## What is NOT changing

- The core compilation logic (`module-graph.ts`, esbuild, source maps, workspace path resolution, CommonJS detection) — all unchanged
- The `preloads()` API — unchanged, still the one scripts-specific method that has no parallel in normal routing
- The security model (only declared entry points are accessible without a content hash) — unchanged, `entryPoints` still enforces this, it's just handler config now not a route definition

---

## The key outcome

After both this plan and the file-cache plan, the bookstore's `app/routes.ts` looks like:

```ts
export let routes = {
  home: '/',
  books: '/books/:id',
  cart: '/cart',
  // ...
  scripts: '/scripts/*path', // ← was in asset-routes.ts, special href()
  images: '/images/*path', // ← was createFilesRoute, special href()
  uploads: '/uploads/*path', // ← was createFilesRoute, special href()
}
```

Scripts, images, and uploads are just routes. No parallel asset route universe. No special href mechanism. The assets monolith is fully dissolved into composable primitives on top of the router.

---

## Order of work

> **This plan should be implemented after `FILE-CACHE-PLAN.md`.** The file-cache plan removes `createFilesRoute`/`createFilesHandler` and deletes `asset-routes.ts` from the bookstore and `routes.ts` from assets-reboot. This plan then completes the cleanup by also removing `createScriptsRoute`.

1. Remove `basePath` from `ScriptsHandlerOptions` — derive base from request URL at runtime
2. Update `handle()` signature to accept module path: `handle(request, path)`
3. Move `entryPoints` into `ScriptsHandlerOptions` directly
4. Delete `createScriptsRoute`, `src/lib/scripts-route.ts`, `src/routes.ts`, `src/lib/typed-glob/`
5. Update `demos/assets-reboot` — `routes.ts` already gone after file-cache plan; update `server.ts`
6. Update `demos/bookstore` — `asset-routes.ts` already deleted by file-cache plan; update `app/routes.ts`, `router.ts`, and `app/utils/assets.ts`
7. Remove `@remix-run/script-handler/routes` export from `packages/remix/package.json`
