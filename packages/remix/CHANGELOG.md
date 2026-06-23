# `remix` CHANGELOG

This is the changelog for [`remix`](https://github.com/remix-run/remix/tree/main/packages/remix). It follows [semantic versioning](https://semver.org/).

## v3.0.0-beta.4

### Pre-release Changes

- BREAKING CHANGE: Middleware consumed through `remix/router` and `remix/fetch-router` must now explicitly continue the request chain by calling `next()` or return a `Response`. Middleware that returned `undefined` without calling `next()` now throws at runtime instead of implicitly continuing.

  Update context-loading middleware to return the downstream response:

  ```ts
  function loadUser(): Middleware {
    return (context, next) => {
      context.set(CurrentUser, user)
      return next()
    }
  }
  ```

- Improve Node compatibility for the `remix/assert` entrypoint.

  The default export is now callable as an alias for `assert.ok`, failure errors expose Node-style metadata, expected-error/message handling more closely follows `node:assert/strict`, strict/deep equality now handles `Object.is` and built-in object comparisons more consistently with Node, and `assert.partialDeepEqual` is available for strict partial deep comparisons.

- Add `router.mount()` and the `RouteBuilder`/`RouteInstaller` types to `remix/router` and `remix/fetch-router` so larger apps can be built from smaller route groups without making feature modules hard-code their final URL. A feature module can now export a local route installer that registers routes like `/`, `/users/:id`, or a route map, and the parent can mount it at `/admin`, `/orgs/:orgId`, or another route pattern prefix while one router still owns request dispatch, matching, middleware, and default handling. Params from the mount pattern are available to mounted handlers, and duplicate param names follow `route-pattern` behavior where the right-most param wins.

  `RouterContext<typeof router>` extracts the request context provided by a router or route builder, so apps can keep root middleware inline and use that router-derived context for `RouterTypes.context`. `createAction()`, direct action objects, and `createController()` now infer middleware-provided values from plain inline middleware arrays, which removes the usual need for intermediate `MiddlewareContext<...>` aliases and explicit generics in stored actions and controllers.

  `createMiddleware()` creates reusable middleware chains that preserve their tuple type without `as const` in the specific cases where a chain crosses an inference boundary: deriving `MiddlewareContext<typeof rootMiddleware>` without a router value, exporting a reusable chain, or returning a chain from a factory. Prefer inline arrays for ordinary `middleware` options on routers, controllers, actions, and route helpers. `Middleware` is now a callable type alias with type-only context metadata, which preserves inline middleware context transforms more reliably than an interface call signature.

  The re-exported router types also keep `createRouter()` and `router.map()` to single call signatures while preserving route params, middleware context inference, and stored action/controller compatibility checks, making the public type surface smaller while everyday route setup gets more expressive.

  BREAKING CHANGE: `MapTarget` and `MapHandler` are no longer re-exported from `remix/router` or `remix/fetch-router`. Use the public `Router`, `RouteBuilder`, `RouteInstaller`, `Action`, and `Controller` types instead.

- Expose `remix/test` timeout and abort signal support through the Remix package.

  Tests and lifecycle hooks can pass `{ timeout, signal }`, and `t.signal` aborts when a test times out. String `skip`/`todo` reasons now flow through `remix/test` results and reporter output.

- Keep generated README mirrors in the published `remix` package so `node_modules/remix/src/<subpath>/README.md` documentation remains available while the duplicated source files stay untracked in git.

- Bumped `@remix-run/*` dependencies:
  - [`assert@0.3.0`](https://github.com/remix-run/remix/releases/tag/assert@0.3.0)
  - [`assets@0.4.3`](https://github.com/remix-run/remix/releases/tag/assets@0.4.3)
  - [`async-context-middleware@0.3.3`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.3.3)
  - [`auth@0.2.5`](https://github.com/remix-run/remix/releases/tag/auth@0.2.5)
  - [`auth-middleware@0.2.3`](https://github.com/remix-run/remix/releases/tag/auth-middleware@0.2.3)
  - [`cli@0.3.3`](https://github.com/remix-run/remix/releases/tag/cli@0.3.3)
  - [`compression-middleware@0.1.11`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.11)
  - [`cop-middleware@0.1.6`](https://github.com/remix-run/remix/releases/tag/cop-middleware@0.1.6)
  - [`cors-middleware@0.1.6`](https://github.com/remix-run/remix/releases/tag/cors-middleware@0.1.6)
  - [`csrf-middleware@0.1.6`](https://github.com/remix-run/remix/releases/tag/csrf-middleware@0.1.6)
  - [`fetch-router@0.20.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.20.0)
  - [`form-data-middleware@0.3.3`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.3.3)
  - [`logger-middleware@0.3.3`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.3.3)
  - [`method-override-middleware@0.1.11`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.11)
  - [`render-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/render-middleware@0.1.3)
  - [`route-pattern@0.22.1`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.22.1)
  - [`session-middleware@0.3.3`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.3.3)
  - [`static-middleware@0.4.12`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.12)
  - [`test@0.5.0`](https://github.com/remix-run/remix/releases/tag/test@0.5.0)

## v3.0.0-beta.3

### Pre-release Changes

- Added `package.json` `exports`:

  - `remix/headers/accept` to re-export APIs from `@remix-run/headers/accept`
  - `remix/headers/accept-encoding` to re-export APIs from `@remix-run/headers/accept-encoding`
  - `remix/headers/accept-language` to re-export APIs from `@remix-run/headers/accept-language`
  - `remix/headers/cache-control` to re-export APIs from `@remix-run/headers/cache-control`
  - `remix/headers/content-disposition` to re-export APIs from `@remix-run/headers/content-disposition`
  - `remix/headers/content-range` to re-export APIs from `@remix-run/headers/content-range`
  - `remix/headers/content-type` to re-export APIs from `@remix-run/headers/content-type`
  - `remix/headers/cookie` to re-export APIs from `@remix-run/headers/cookie`
  - `remix/headers/if-match` to re-export APIs from `@remix-run/headers/if-match`
  - `remix/headers/if-none-match` to re-export APIs from `@remix-run/headers/if-none-match`
  - `remix/headers/if-range` to re-export APIs from `@remix-run/headers/if-range`
  - `remix/headers/range` to re-export APIs from `@remix-run/headers/range`
  - `remix/headers/raw-headers` to re-export APIs from `@remix-run/headers/raw-headers`
  - `remix/headers/set-cookie` to re-export APIs from `@remix-run/headers/set-cookie`
  - `remix/headers/vary` to re-export APIs from `@remix-run/headers/vary`

- Updated `remix/ui/anchor` `anchor(floating, anchorTarget, options)` to accept either an `HTMLElement` or coordinate target via the new `AnchorPoint`/`AnchorTarget` types.

- Added `remix/ui/menu` `menu.contextTrigger()` so menus can open from right-click pointer locations while keeping existing keyboard navigation, submenus, and selection behavior.
  Updated `remix/ui/anchor` `anchor(floating, anchorTarget, options)` to accept either an `HTMLElement` or coordinate target via the new `AnchorPoint`/`AnchorTarget` types, and added `remix/ui/menu` `menu.contextTrigger()` so menus can open from right-click pointer locations while keeping existing menu behavior.

- Update the optional `playwright` peer dependency range to match the workspace Playwright catalog version.

- Bumped `@remix-run/*` dependencies:
  - [`assets@0.4.2`](https://github.com/remix-run/remix/releases/tag/assets@0.4.2)
  - [`async-context-middleware@0.3.2`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.3.2)
  - [`auth@0.2.4`](https://github.com/remix-run/remix/releases/tag/auth@0.2.4)
  - [`auth-middleware@0.2.2`](https://github.com/remix-run/remix/releases/tag/auth-middleware@0.2.2)
  - [`cli@0.3.2`](https://github.com/remix-run/remix/releases/tag/cli@0.3.2)
  - [`compression-middleware@0.1.10`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.10)
  - [`cookie@0.5.4`](https://github.com/remix-run/remix/releases/tag/cookie@0.5.4)
  - [`cop-middleware@0.1.5`](https://github.com/remix-run/remix/releases/tag/cop-middleware@0.1.5)
  - [`cors-middleware@0.1.5`](https://github.com/remix-run/remix/releases/tag/cors-middleware@0.1.5)
  - [`csrf-middleware@0.1.5`](https://github.com/remix-run/remix/releases/tag/csrf-middleware@0.1.5)
  - [`data-table-sqlite@0.5.1`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.5.1)
  - [`fetch-proxy@0.8.3`](https://github.com/remix-run/remix/releases/tag/fetch-proxy@0.8.3)
  - [`fetch-router@0.19.2`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.2)
  - [`file-storage@0.13.6`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.6)
  - [`file-storage-s3@0.1.3`](https://github.com/remix-run/remix/releases/tag/file-storage-s3@0.1.3)
  - [`form-data-middleware@0.3.2`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.3.2)
  - [`form-data-parser@0.17.3`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.17.3)
  - [`fs@0.4.5`](https://github.com/remix-run/remix/releases/tag/fs@0.4.5)
  - [`headers@0.21.1`](https://github.com/remix-run/remix/releases/tag/headers@0.21.1)
  - [`lazy-file@5.0.5`](https://github.com/remix-run/remix/releases/tag/lazy-file@5.0.5)
  - [`logger-middleware@0.3.2`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.3.2)
  - [`method-override-middleware@0.1.10`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.10)
  - [`multipart-parser@0.16.3`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.3)
  - [`render-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/render-middleware@0.1.2)
  - [`response@0.3.6`](https://github.com/remix-run/remix/releases/tag/response@0.3.6)
  - [`route-pattern@0.22.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.22.0)
  - [`session-middleware@0.3.2`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.3.2)
  - [`session-storage-memcache@0.1.2`](https://github.com/remix-run/remix/releases/tag/session-storage-memcache@0.1.2)
  - [`static-middleware@0.4.11`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.11)
  - [`test@0.4.2`](https://github.com/remix-run/remix/releases/tag/test@0.4.2)
  - [`ui@0.3.0`](https://github.com/remix-run/remix/releases/tag/ui@0.3.0)

## v3.0.0-beta.2

### Pre-release Changes

- Removed `remix/node-serve` and `@remix-run/node-serve` from this beta so installing Remix no longer pulls in the native transport dependency that currently blocks some package managers and runtimes. We expect to restore node-serve in a future beta after its native dependency is published through npm-compatible packages (see #11439).

- Expose `SuperHeaders#apply(init)` through `remix/headers` so apps can apply `SuperHeadersInit` values to an existing instance with header-aware behavior (see #11398).

- Carry explicit public type annotations from underlying packages through re-exported Remix package APIs so generated declarations stay aligned with the owning package APIs (see #11433).

- Expose the updated `remix/file-storage` types, including the new `FileLike` alias and filesystem storage `LazyFile` return types (see #11430).

- Fix `Cookie` and `SuperHeaders.cookie` from `remix/headers` so duplicate cookie names from path- or domain-specific cookies are preserved in order. `Cookie#get(name)` now returns the first matching value, `Cookie#getAll(name)` can be used to read every matching value, and `Cookie#append(name, value)` can be used to add another cookie with the same name (see #11423).

- Bumped `@remix-run/*` dependencies:
  - [`assert@0.2.1`](https://github.com/remix-run/remix/releases/tag/assert@0.2.1)
  - [`assets@0.4.1`](https://github.com/remix-run/remix/releases/tag/assets@0.4.1)
  - [`async-context-middleware@0.3.1`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.3.1)
  - [`auth@0.2.3`](https://github.com/remix-run/remix/releases/tag/auth@0.2.3)
  - [`auth-middleware@0.2.1`](https://github.com/remix-run/remix/releases/tag/auth-middleware@0.2.1)
  - [`cli@0.3.1`](https://github.com/remix-run/remix/releases/tag/cli@0.3.1)
  - [`compression-middleware@0.1.9`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.9)
  - [`cookie@0.5.3`](https://github.com/remix-run/remix/releases/tag/cookie@0.5.3)
  - [`cop-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/cop-middleware@0.1.4)
  - [`cors-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/cors-middleware@0.1.4)
  - [`csrf-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/csrf-middleware@0.1.4)
  - [`fetch-proxy@0.8.2`](https://github.com/remix-run/remix/releases/tag/fetch-proxy@0.8.2)
  - [`fetch-router@0.19.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.1)
  - [`file-storage@0.13.5`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.5)
  - [`file-storage-s3@0.1.2`](https://github.com/remix-run/remix/releases/tag/file-storage-s3@0.1.2)
  - [`form-data-middleware@0.3.1`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.3.1)
  - [`form-data-parser@0.17.2`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.17.2)
  - [`fs@0.4.4`](https://github.com/remix-run/remix/releases/tag/fs@0.4.4)
  - [`headers@0.21.0`](https://github.com/remix-run/remix/releases/tag/headers@0.21.0)
  - [`html-template@0.3.1`](https://github.com/remix-run/remix/releases/tag/html-template@0.3.1)
  - [`lazy-file@5.0.4`](https://github.com/remix-run/remix/releases/tag/lazy-file@5.0.4)
  - [`logger-middleware@0.3.1`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.3.1)
  - [`method-override-middleware@0.1.9`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.9)
  - [`multipart-parser@0.16.2`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.2)
  - [`node-fetch-server@0.13.3`](https://github.com/remix-run/remix/releases/tag/node-fetch-server@0.13.3)
  - [`node-tsx@0.1.1`](https://github.com/remix-run/remix/releases/tag/node-tsx@0.1.1)
  - [`render-middleware@0.1.1`](https://github.com/remix-run/remix/releases/tag/render-middleware@0.1.1)
  - [`response@0.3.5`](https://github.com/remix-run/remix/releases/tag/response@0.3.5)
  - [`route-pattern@0.21.1`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.21.1)
  - [`session@0.4.2`](https://github.com/remix-run/remix/releases/tag/session@0.4.2)
  - [`session-middleware@0.3.1`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.3.1)
  - [`session-storage-memcache@0.1.1`](https://github.com/remix-run/remix/releases/tag/session-storage-memcache@0.1.1)
  - [`session-storage-redis@0.1.1`](https://github.com/remix-run/remix/releases/tag/session-storage-redis@0.1.1)
  - [`static-middleware@0.4.10`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.10)
  - [`terminal@0.1.1`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.1)
  - [`test@0.4.1`](https://github.com/remix-run/remix/releases/tag/test@0.4.1)
  - [`ui@0.2.0`](https://github.com/remix-run/remix/releases/tag/ui@0.2.0)

## v3.0.0-beta.1

### Pre-release Changes

- BREAKING CHANGE: Removed the `ContextWithAuth` and `ContextWithRequiredAuth` helper types from `remix/auth-middleware`. Derive auth-aware request context from the actual auth middleware tuple with `MiddlewareContext`, or use the core `ContextWithEntry` helper from `remix/fetch-router` when manually composing context types without a middleware tuple.

  ```ts
  import { requireAuth } from 'remix/auth-middleware'
  import type { MiddlewareContext } from 'remix/fetch-router'

  let protectedMiddleware = [requireAuth<AuthIdentity>()] as const
  type AppAuthContext = MiddlewareContext<typeof protectedMiddleware, AppContext>
  ```

- BREAKING CHANGE: Remix app scaffolding, `remix doctor`, and `remix routes` now use `app/actions` with controller files only. The old `app/controllers` directory name has been replaced by `app/actions`, and root route actions should no longer live in standalone files.

  Move route controllers from `app/controllers` to `app/actions`, consolidate root route actions into `app/actions/controller.tsx`, and map nested route maps explicitly in `app/router.ts` with one `router.map(...)` call per route map. Controller middleware applies only to direct actions owned by that controller.

- BREAKING CHANGE: Removed the `ContextWithRenderer` helper type from `remix/render-middleware`. Derive renderer-aware request context from the `renderWith()` middleware tuple with `MiddlewareContext`, or use the core `ContextWithEntry` helper from `remix/fetch-router` when manually composing context types without a middleware tuple.

  ```ts
  import { renderWith } from 'remix/render-middleware'
  import type { MiddlewareContext } from 'remix/fetch-router'

  let render = renderWith(() => (value: string) => new Response(value))
  type AppContext = MiddlewareContext<[typeof render]>
  ```

- BREAKING CHANGE: `remix test` and `remix/test` now use Remix's internal `node-tsx` loader instead of the `tsx` package.

  Test modules are still transformed before execution, including JSX and TypeScript syntax that requires JavaScript output, but the loader is now maintained inside Remix through `remix/node-tsx`.

- BREAKING CHANGE: `remix/async-context-middleware` no longer exposes `AsyncContextTypes`. `getContext()` now derives its type from `remix/fetch-router`'s `RouterTypes.context`, with route params broadened to `AnyParams`, so apps only need the router context augmentation.

- BREAKING CHANGE: Updated the re-exported `remix/fetch-router` helper types around full request-context types and stored route handlers. `Action`, `Controller`, and `RequestHandler` now take the full request context type, `MiddlewareContext` accepts middleware values plus an optional base context, and `createAction()`/`createController()` are the preferred helpers for stored handlers.

  For most apps, configure `RouterTypes.context` once and let `createController()` infer route action context from the route map and controller middleware:

  ```ts
  declare module 'remix/fetch-router' {
    interface RouterTypes {
      context: AppContext
    }
  }

  let accountMiddleware = [requireAuth<AuthIdentity>()] as const

  let controller = createController(routes, {
    middleware: accountMiddleware,
    actions: {
      account(context) {
        return Response.json(context.auth.identity)
      },
    },
  })
  ```

  Low-level context transform helpers such as `BuildAction`, `MiddlewareContextTransform`, `ContextTransform`, `ApplyContextTransform`, `ApplyMiddleware`, and `ApplyMiddlewareTuple` are no longer exported. Use `ContextWithParams`, `ContextWithEntry`, `ContextWithEntries`, `MiddlewareContext`, and `RouteEntry` when manually composing request context or custom matcher payloads.

- BREAKING CHANGE: In `remix/route-pattern`, remove the `compareFn` parameter from `match` and `matchAll`.

  Matches always sort by specificity (most specific first). If you need a different order, sort the result of `matchAll` yourself.

  ```ts
  import * as Specificity from 'remix/route-pattern/specificity'

  // before
  matcher.matchAll(url, Specificity.ascending)

  // after
  matcher.matchAll(url).sort(Specificity.ascending)
  ```

- BREAKING CHANGE: New modular `remix/route-pattern` APIs and subpath exports

  Previously, `remix/route-pattern` bundled URL generation, matching, and specificity helpers into one entrypoint. A typical Remix app does not do any client-side matching, but all the matching logic would ship to the browser anyway, causing JS bloat.

  Now, route pattern features are organized into separate subpath exports, so even without a bundler, only the code you need ends up in the browser:

  - `remix/route-pattern/href` generates hrefs for patterns with type-safe params.
  - `remix/route-pattern/match` matches against one pattern with type inference for params, or against many patterns with deterministic ranking and attached data.
  - `remix/route-pattern/join` combines two patterns into one, including protocol, hostname, port, pathname, and search constraints.
  - `remix/route-pattern/specificity` continues to provide utilities for ranking matches.

  The base `remix/route-pattern` export now focuses on parsing and serializing route patterns.

- Expose `@remix-run/node-tsx` through `remix/node-tsx` and `remix/node-tsx/load-module`.

  Use `node --import remix/node-tsx` to run `.ts`, `.tsx`, and `.jsx` files directly in Node.js with TypeScript and JSX syntax support. The loader transforms TypeScript syntax that requires JavaScript output, including enums, runtime namespaces, and parameter properties, while preserving Node.js module resolution.

- Updated the `remix` package with domain-oriented exports, no longer only mapping 1:1 to underlying `@remix-run/*` packages. Existing 1:1 package exports remain available during the beta migration and will be removed before a Remix 3.0.0 stable release.

  Preferred package mappings:

  - `remix/async-context-middleware` → `remix/middleware/async-context`
  - `remix/auth-middleware` → `remix/middleware/auth`
  - `remix/compression-middleware` → `remix/middleware/compression`
  - `remix/cop-middleware` → `remix/middleware/cop`
  - `remix/cors-middleware` → `remix/middleware/cors`
  - `remix/csrf-middleware` → `remix/middleware/csrf`
  - `remix/data-table-mysql` → `remix/data-table/mysql`
  - `remix/data-table-postgres` → `remix/data-table/postgres`
  - `remix/data-table-sqlite` → `remix/data-table/sqlite`
  - `remix/fetch-router` → `remix/router`
  - `remix/fetch-router/routes` → `remix/routes`
  - `remix/file-storage-s3` → `remix/file-storage/s3`
  - `remix/form-data-middleware` → `remix/middleware/form-data`
  - `remix/logger-middleware` → `remix/middleware/logger`
  - `remix/method-override-middleware` → `remix/middleware/method-override`
  - `remix/render-middleware` → `remix/middleware/render`
  - `remix/session-middleware` → `remix/middleware/session`
  - `remix/session-storage-memcache` → `remix/session-storage/memcache`
  - `remix/session-storage-redis` → `remix/session-storage/redis`
  - `remix/session/cookie-storage` → `remix/session-storage/cookie`
  - `remix/session/fs-storage` → `remix/session-storage/fs`
  - `remix/session/memory-storage` → `remix/session-storage/memory`
  - `remix/static-middleware` → `remix/middleware/static`

- Added support for middleware-installed direct request context properties through `remix/fetch-router`, including the new `ContextEntry` type for object-shaped context entries. Built-in middleware now uses this for `context.auth`, `context.formData`, `context.logger`, `context.render`, and `context.session`; keyed access with `context.get(...)` remains supported.

- Expose the `node-serve` `setup(app)` option through `remix/node-serve` so apps can register native uWebSockets.js WebSocket routes and connection filters before the Fetch fallback route starts listening.

  ```ts
  import { serve } from 'remix/node-serve'

  serve(handler, {
    setup(app) {
      app.ws('/ws/chat', {
        message(ws, message, isBinary) {
          ws.publish('chat', message, isBinary)
        },
      })
    },
  })
  ```

- Include source-adjacent README files for generated `remix/*` exports in the published package so package managers and tooling can discover the relevant module documentation from `node_modules/remix`.

- Fix `remix/node-fetch-server` so streaming responses write the first chunk immediately instead of waiting for another chunk.

- Fix matching so dynamic pathname segments and wildcard continuations only match when they cover the full pathname range being tested.

  ```ts
  import { createMultiMatcher } from 'remix/route-pattern'

  let matcher = createMultiMatcher<string>()
  matcher.add('/files/:name.md', 'markdown')
  matcher.add('/files/:name.md.backup', 'backup')

  // before: matched both patterns because `/files/:name.md` matched a prefix of the segment
  matcher.matchAll('https://example.com/files/readme.md.backup').map((match) => match.data)
  // ['backup', 'markdown']

  // after: only matches when the pattern covers the whole segment
  matcher.matchAll('https://example.com/files/readme.md.backup').map((match) => match.data)
  // ['backup']
  ```

- Bumped `@remix-run/*` dependencies:
  - [`assets@0.4.0`](https://github.com/remix-run/remix/releases/tag/assets@0.4.0)
  - [`async-context-middleware@0.3.0`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.3.0)
  - [`auth@0.2.2`](https://github.com/remix-run/remix/releases/tag/auth@0.2.2)
  - [`auth-middleware@0.2.0`](https://github.com/remix-run/remix/releases/tag/auth-middleware@0.2.0)
  - [`cli@0.3.0`](https://github.com/remix-run/remix/releases/tag/cli@0.3.0)
  - [`compression-middleware@0.1.8`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.8)
  - [`cookie@0.5.2`](https://github.com/remix-run/remix/releases/tag/cookie@0.5.2)
  - [`cop-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/cop-middleware@0.1.3)
  - [`cors-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/cors-middleware@0.1.3)
  - [`csrf-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/csrf-middleware@0.1.3)
  - [`data-table@0.3.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.3.0)
  - [`data-table-mysql@0.4.0`](https://github.com/remix-run/remix/releases/tag/data-table-mysql@0.4.0)
  - [`data-table-postgres@0.4.0`](https://github.com/remix-run/remix/releases/tag/data-table-postgres@0.4.0)
  - [`data-table-sqlite@0.5.0`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.5.0)
  - [`fetch-proxy@0.8.1`](https://github.com/remix-run/remix/releases/tag/fetch-proxy@0.8.1)
  - [`fetch-router@0.19.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.0)
  - [`form-data-middleware@0.3.0`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.3.0)
  - [`form-data-parser@0.17.1`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.17.1)
  - [`headers@0.20.0`](https://github.com/remix-run/remix/releases/tag/headers@0.20.0)
  - [`logger-middleware@0.3.0`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.3.0)
  - [`method-override-middleware@0.1.8`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.8)
  - [`multipart-parser@0.16.1`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.1)
  - [`node-fetch-server@0.13.2`](https://github.com/remix-run/remix/releases/tag/node-fetch-server@0.13.2)
  - [`node-serve@0.2.0`](https://github.com/remix-run/remix/releases/tag/node-serve@0.2.0)
  - [`node-tsx@0.1.0`](https://github.com/remix-run/remix/releases/tag/node-tsx@0.1.0)
  - [`render-middleware@0.1.0`](https://github.com/remix-run/remix/releases/tag/render-middleware@0.1.0)
  - [`response@0.3.4`](https://github.com/remix-run/remix/releases/tag/response@0.3.4)
  - [`route-pattern@0.21.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.21.0)
  - [`session-middleware@0.3.0`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.3.0)
  - [`static-middleware@0.4.9`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.9)
  - [`test@0.4.0`](https://github.com/remix-run/remix/releases/tag/test@0.4.0)
  - [`ui@0.1.2`](https://github.com/remix-run/remix/releases/tag/ui@0.1.2)

## v3.0.0-beta.0

### Pre-release Changes

- BREAKING CHANGE: Removed the deprecated `remix/component`, `remix/component/jsx-runtime`, `remix/component/jsx-dev-runtime`, and `remix/component/server` package exports. Import the consolidated UI runtime from `remix/ui`, `remix/ui/jsx-runtime`, `remix/ui/jsx-dev-runtime`, and `remix/ui/server` instead.

  Removed `package.json` `bin` commands:

  - `remix-test`

  Added `package.json` `exports`:

  - `remix/node-fetch-server/test` to re-export APIs from `@remix-run/node-fetch-server/test`
  - `remix/node-serve` to re-export APIs from `@remix-run/node-serve`
  - `remix/terminal` to re-export APIs from `@remix-run/terminal`
  - `remix/test/cli` to re-export APIs from `@remix-run/test/cli`

  Added `package.json` `exports` for the consolidated UI runtime:

  - `remix/ui` to re-export APIs from `@remix-run/ui`
  - `remix/ui/jsx-runtime` to re-export APIs from `@remix-run/ui/jsx-runtime`
  - `remix/ui/jsx-dev-runtime` to re-export APIs from `@remix-run/ui/jsx-dev-runtime`
  - `remix/ui/server` to re-export APIs from `@remix-run/ui/server`
  - `remix/ui/animation` to re-export APIs from `@remix-run/ui/animation`
  - `remix/ui/accordion` to re-export APIs from `@remix-run/ui/accordion`
  - `remix/ui/anchor` to re-export APIs from `@remix-run/ui/anchor`
  - `remix/ui/breadcrumbs` to re-export APIs from `@remix-run/ui/breadcrumbs`
  - `remix/ui/button` to re-export APIs from `@remix-run/ui/button`
  - `remix/ui/combobox` to re-export APIs from `@remix-run/ui/combobox`
  - `remix/ui/glyph` to re-export APIs from `@remix-run/ui/glyph`
  - `remix/ui/listbox` to re-export APIs from `@remix-run/ui/listbox`
  - `remix/ui/menu` to re-export APIs from `@remix-run/ui/menu`
  - `remix/ui/popover` to re-export APIs from `@remix-run/ui/popover`
  - `remix/ui/scroll-lock` to re-export APIs from `@remix-run/ui/scroll-lock`
  - `remix/ui/select` to re-export APIs from `@remix-run/ui/select`
  - `remix/ui/separator` to re-export APIs from `@remix-run/ui/separator`
  - `remix/ui/theme` to re-export APIs from `@remix-run/ui/theme`
  - `remix/ui/test` to re-export APIs from `@remix-run/ui/test`

- Added optional peer dependency metadata for feature-specific packages exposed through `remix` exports, including database drivers and Playwright.

- Bumped `@remix-run/*` dependencies:
  - [`assert@0.2.0`](https://github.com/remix-run/remix/releases/tag/assert@0.2.0)
  - [`assets@0.3.0`](https://github.com/remix-run/remix/releases/tag/assets@0.3.0)
  - [`async-context-middleware@0.2.2`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.2.2)
  - [`auth@0.2.1`](https://github.com/remix-run/remix/releases/tag/auth@0.2.1)
  - [`auth-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/auth-middleware@0.1.2)
  - [`cli@0.2.0`](https://github.com/remix-run/remix/releases/tag/cli@0.2.0)
  - [`compression-middleware@0.1.7`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.7)
  - [`cop-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/cop-middleware@0.1.2)
  - [`cors-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/cors-middleware@0.1.2)
  - [`csrf-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/csrf-middleware@0.1.2)
  - [`data-table@0.2.1`](https://github.com/remix-run/remix/releases/tag/data-table@0.2.1)
  - [`data-table-mysql@0.3.1`](https://github.com/remix-run/remix/releases/tag/data-table-mysql@0.3.1)
  - [`data-table-postgres@0.3.1`](https://github.com/remix-run/remix/releases/tag/data-table-postgres@0.3.1)
  - [`data-table-sqlite@0.4.1`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.4.1)
  - [`fetch-router@0.18.2`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.2)
  - [`form-data-middleware@0.2.3`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.2.3)
  - [`logger-middleware@0.2.1`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.2.1)
  - [`method-override-middleware@0.1.7`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.7)
  - [`node-fetch-server@0.13.1`](https://github.com/remix-run/remix/releases/tag/node-fetch-server@0.13.1)
  - [`node-serve@0.1.0`](https://github.com/remix-run/remix/releases/tag/node-serve@0.1.0)
  - [`session-middleware@0.2.2`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.2.2)
  - [`static-middleware@0.4.8`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.8)
  - [`test@0.3.0`](https://github.com/remix-run/remix/releases/tag/test@0.3.0)
  - [`ui@0.1.1`](https://github.com/remix-run/remix/releases/tag/ui@0.1.1)

## v3.0.0-alpha.6

### Pre-release Changes

- BREAKING CHANGE: `MultipartPart.headers` from `remix/multipart-parser` and `remix/multipart-parser/node` is now a plain decoded object keyed by lower-case header name instead of a native `Headers` instance. Access part headers with bracket notation like `part.headers['content-type']` instead of `part.headers.get('Content-Type')`.

- BREAKING CHANGE: Removed the deprecated `remix/component`, `remix/component/jsx-runtime`, `remix/component/jsx-dev-runtime`, and `remix/component/server` package exports. Import the consolidated UI runtime from `remix/ui`, `remix/ui/jsx-runtime`, `remix/ui/jsx-dev-runtime`, and `remix/ui/server` instead.

  Removed `package.json` `bin` commands:

  - `remix-test`

  Added `package.json` `exports`:

  - `remix/node-fetch-server/test` to re-export APIs from `@remix-run/node-fetch-server/test`
  - `remix/terminal` to re-export APIs from `@remix-run/terminal`
  - `remix/test/cli` to re-export APIs from `@remix-run/test/cli`

  Added `package.json` `exports` for the consolidated UI runtime:

  - `remix/ui` to re-export APIs from `@remix-run/ui`
  - `remix/ui/jsx-runtime` to re-export APIs from `@remix-run/ui/jsx-runtime`
  - `remix/ui/jsx-dev-runtime` to re-export APIs from `@remix-run/ui/jsx-dev-runtime`
  - `remix/ui/server` to re-export APIs from `@remix-run/ui/server`
  - `remix/ui/animation` to re-export APIs from `@remix-run/ui/animation`
  - `remix/ui/accordion` to re-export APIs from `@remix-run/ui/accordion`
  - `remix/ui/anchor` to re-export APIs from `@remix-run/ui/anchor`
  - `remix/ui/breadcrumbs` to re-export APIs from `@remix-run/ui/breadcrumbs`
  - `remix/ui/button` to re-export APIs from `@remix-run/ui/button`
  - `remix/ui/combobox` to re-export APIs from `@remix-run/ui/combobox`
  - `remix/ui/glyph` to re-export APIs from `@remix-run/ui/glyph`
  - `remix/ui/listbox` to re-export APIs from `@remix-run/ui/listbox`
  - `remix/ui/menu` to re-export APIs from `@remix-run/ui/menu`
  - `remix/ui/popover` to re-export APIs from `@remix-run/ui/popover`
  - `remix/ui/scroll-lock` to re-export APIs from `@remix-run/ui/scroll-lock`
  - `remix/ui/select` to re-export APIs from `@remix-run/ui/select`
  - `remix/ui/separator` to re-export APIs from `@remix-run/ui/separator`
  - `remix/ui/theme` to re-export APIs from `@remix-run/ui/theme`
  - `remix/ui/test` to re-export APIs from `@remix-run/ui/test`

- Added `package.json` exports and binaries for the Remix CLI:

  - `remix/cli` to expose the Remix CLI programmatic API
  - `remix` as a `package.json` `bin` command that delegates to `@remix-run/cli`

  The Remix CLI now reads the current Remix version from the `remix` package and declares Node.js 24.3.0 or later in package metadata.

- Bumped `@remix-run/*` dependencies:
  - [`assets@0.2.0`](https://github.com/remix-run/remix/releases/tag/assets@0.2.0)
  - [`auth@0.2.0`](https://github.com/remix-run/remix/releases/tag/auth@0.2.0)
  - [`cli@0.1.0`](https://github.com/remix-run/remix/releases/tag/cli@0.1.0)
  - [`compression-middleware@0.1.6`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.6)
  - [`data-schema@0.3.0`](https://github.com/remix-run/remix/releases/tag/data-schema@0.3.0)
  - [`data-table-sqlite@0.4.0`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.4.0)
  - [`fetch-proxy@0.8.0`](https://github.com/remix-run/remix/releases/tag/fetch-proxy@0.8.0)
  - [`file-storage@0.13.4`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.4)
  - [`file-storage-s3@0.1.1`](https://github.com/remix-run/remix/releases/tag/file-storage-s3@0.1.1)
  - [`form-data-middleware@0.2.2`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.2.2)
  - [`form-data-parser@0.17.0`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.17.0)
  - [`fs@0.4.3`](https://github.com/remix-run/remix/releases/tag/fs@0.4.3)
  - [`lazy-file@5.0.3`](https://github.com/remix-run/remix/releases/tag/lazy-file@5.0.3)
  - [`logger-middleware@0.2.0`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.2.0)
  - [`mime@0.4.1`](https://github.com/remix-run/remix/releases/tag/mime@0.4.1)
  - [`multipart-parser@0.16.0`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.0)
  - [`response@0.3.3`](https://github.com/remix-run/remix/releases/tag/response@0.3.3)
  - [`static-middleware@0.4.7`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.7)
  - [`tar-parser@0.7.1`](https://github.com/remix-run/remix/releases/tag/tar-parser@0.7.1)
  - [`terminal@0.1.0`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.0)
  - [`test@0.2.0`](https://github.com/remix-run/remix/releases/tag/test@0.2.0)
  - [`ui@0.1.0`](https://github.com/remix-run/remix/releases/tag/ui@0.1.0)

## v3.0.0-alpha.5

### Pre-release Changes

- Added `package.json` `exports`:

  - `remix/assert` to re-export APIs from `@remix-run/assert`
  - `remix/test` to re-export APIs from `@remix-run/test`

  Added `package.json` `bin` commands:

  - `remix-test` delegating to `@remix-run/test`

- Bumped `@remix-run/*` dependencies:
  - [`assert@0.1.0`](https://github.com/remix-run/remix/releases/tag/assert@0.1.0)
  - [`assets@0.1.0`](https://github.com/remix-run/remix/releases/tag/assets@0.1.0)
  - [`async-context-middleware@0.2.1`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.2.1)
  - [`auth@0.1.1`](https://github.com/remix-run/remix/releases/tag/auth@0.1.1)
  - [`auth-middleware@0.1.1`](https://github.com/remix-run/remix/releases/tag/auth-middleware@0.1.1)
  - [`component@0.7.0`](https://github.com/remix-run/remix/releases/tag/component@0.7.0)
  - [`compression-middleware@0.1.5`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.5)
  - [`cop-middleware@0.1.1`](https://github.com/remix-run/remix/releases/tag/cop-middleware@0.1.1)
  - [`cors-middleware@0.1.1`](https://github.com/remix-run/remix/releases/tag/cors-middleware@0.1.1)
  - [`csrf-middleware@0.1.1`](https://github.com/remix-run/remix/releases/tag/csrf-middleware@0.1.1)
  - [`data-table-mysql@0.3.0`](https://github.com/remix-run/remix/releases/tag/data-table-mysql@0.3.0)
  - [`data-table-postgres@0.3.0`](https://github.com/remix-run/remix/releases/tag/data-table-postgres@0.3.0)
  - [`data-table-sqlite@0.3.0`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.3.0)
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)
  - [`form-data-middleware@0.2.1`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.2.1)
  - [`logger-middleware@0.1.5`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.1.5)
  - [`method-override-middleware@0.1.6`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.6)
  - [`route-pattern@0.20.1`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.20.1)
  - [`session-middleware@0.2.1`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.2.1)
  - [`static-middleware@0.4.6`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.6)
  - [`test@0.1.0`](https://github.com/remix-run/remix/releases/tag/test@0.1.0)

## v3.0.0-alpha.4

### Pre-release Changes

- BREAKING CHANGE: Remove the `remix/data-table/sql` export. Import `SqlStatement`, `sql`, and `rawSql` from `remix/data-table` instead.

  `remix/data-table/sql-helpers` remains available for adapter-facing SQL utilities.

  `remix/data-table` now exports the `Database` class as a runtime value. You can construct a database directly with `new Database(adapter, options)` or keep using `createDatabase(adapter, options)`, which now delegates to the class constructor.

  BREAKING CHANGE: `remix/data-table` no longer exports `QueryBuilder`. Import `Query` and `query` from `remix/data-table`, then execute unbound queries with `db.exec(...)`. `db.exec(...)` now accepts only raw SQL or `Query` values, and unbound terminal methods like `first()`, `count()`, `insert()`, and `update()` return `Query` objects instead of separate command descriptor types. `db.query(table)` remains available as shorthand and now returns the same bound `Query` class.

  `remix/data-table/migrations` no longer exports a separate `Database` type alias. Import `Database` from `remix/data-table` when you need the migration `db` type directly.

  The incidental `QueryMethod` type export has also been removed; use `Database['query']` or `QueryForTable<table>` when you need that type shape.

  Added `package.json` `exports`:

  - `remix/auth-middleware` to re-export APIs from `@remix-run/auth-middleware`
  - `remix/auth` to re-export APIs from `@remix-run/auth`

- Add `remix/cors-middleware` to re-export the CORS middleware APIs from `@remix-run/cors-middleware`.

- Update `remix/ui` and `remix/ui/server` to re-export the latest `@remix-run/ui` frame-navigation APIs.

  `remix/ui` now exposes `navigate(href, { src, target, history })`, `link(href, { src, target, history })`, `run({ loadModule, resolveFrame })`, and the `handle.frames.top` and `handle.frames.get(name)` helpers, while `remix/ui/server` re-exports the SSR frame source APIs including `frameSrc`, `topFrameSrc`, and `ResolveFrameContext`.

- Add browser-origin and CSRF protection middleware APIs to `remix`.

  - `remix/cop-middleware` exposes `cop(options)` for browser-focused cross-origin protection using `Sec-Fetch-Site` with `Origin` fallback, trusted origins, and configurable bypasses.
  - `remix/csrf-middleware` exposes `csrf(options)` and `getCsrfToken(context)` for session-backed CSRF tokens plus origin validation.
  - Apps can use either middleware independently or layer `cop()`, `session()`, and `csrf()` together when they want both browser-origin filtering and token-backed protection.

- Bumped `@remix-run/*` dependencies:
  - [`async-context-middleware@0.2.0`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.2.0)
  - [`auth@0.1.0`](https://github.com/remix-run/remix/releases/tag/auth@0.1.0)
  - [`auth-middleware@0.1.0`](https://github.com/remix-run/remix/releases/tag/auth-middleware@0.1.0)
  - [`component@0.6.0`](https://github.com/remix-run/remix/releases/tag/component@0.6.0)
  - [`compression-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.4)
  - [`cop-middleware@0.1.0`](https://github.com/remix-run/remix/releases/tag/cop-middleware@0.1.0)
  - [`cors-middleware@0.1.0`](https://github.com/remix-run/remix/releases/tag/cors-middleware@0.1.0)
  - [`csrf-middleware@0.1.0`](https://github.com/remix-run/remix/releases/tag/csrf-middleware@0.1.0)
  - [`data-schema@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-schema@0.2.0)
  - [`data-table@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.2.0)
  - [`data-table-mysql@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table-mysql@0.2.0)
  - [`data-table-postgres@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table-postgres@0.2.0)
  - [`data-table-sqlite@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.2.0)
  - [`fetch-router@0.18.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.0)
  - [`form-data-middleware@0.2.0`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.2.0)
  - [`form-data-parser@0.16.0`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.16.0)
  - [`logger-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.1.4)
  - [`method-override-middleware@0.1.5`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.5)
  - [`multipart-parser@0.15.0`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.15.0)
  - [`route-pattern@0.20.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.20.0)
  - [`session-middleware@0.2.0`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.2.0)
  - [`static-middleware@0.4.5`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.5)

## v3.0.0-alpha.3

### Pre-release Changes

- Added `package.json` `exports`:

  - `remix/data-schema` to re-export APIs from `@remix-run/data-schema`
  - `remix/data-schema/checks` to re-export APIs from `@remix-run/data-schema/checks`
  - `remix/data-schema/coerce` to re-export APIs from `@remix-run/data-schema/coerce`
  - `remix/data-schema/lazy` to re-export APIs from `@remix-run/data-schema/lazy`
  - `remix/data-table` to re-export APIs from `@remix-run/data-table`
  - `remix/data-table-mysql` to re-export APIs from `@remix-run/data-table-mysql`
  - `remix/data-table-postgres` to re-export APIs from `@remix-run/data-table-postgres`
  - `remix/data-table-sqlite` to re-export APIs from `@remix-run/data-table-sqlite`
  - `remix/fetch-router/routes` to re-export APIs from `@remix-run/fetch-router/routes`
  - `remix/file-storage-s3` to re-export APIs from `@remix-run/file-storage-s3`
  - `remix/session-storage-memcache` to re-export APIs from `@remix-run/session-storage-memcache`
  - `remix/session-storage-redis` to re-export APIs from `@remix-run/session-storage-redis`

- Remove the root export from the `remix` package so you will no longer import anything from `remix` and will instead always import from a sub-path such as `remix/fetch-router` or `remix/ui`

- Bumped `@remix-run/*` dependencies:
  - [`async-context-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.1.3)
  - [`component@0.5.0`](https://github.com/remix-run/remix/releases/tag/component@0.5.0)
  - [`compression-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.3)
  - [`data-schema@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-schema@0.1.0)
  - [`data-table@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.1.0)
  - [`data-table-mysql@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table-mysql@0.1.0)
  - [`data-table-postgres@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table-postgres@0.1.0)
  - [`data-table-sqlite@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.1.0)
  - [`fetch-router@0.17.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.17.0)
  - [`file-storage@0.13.3`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.3)
  - [`file-storage-s3@0.1.0`](https://github.com/remix-run/remix/releases/tag/file-storage-s3@0.1.0)
  - [`form-data-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.1.4)
  - [`fs@0.4.2`](https://github.com/remix-run/remix/releases/tag/fs@0.4.2)
  - [`lazy-file@5.0.2`](https://github.com/remix-run/remix/releases/tag/lazy-file@5.0.2)
  - [`logger-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.1.3)
  - [`method-override-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.4)
  - [`mime@0.4.0`](https://github.com/remix-run/remix/releases/tag/mime@0.4.0)
  - [`response@0.3.2`](https://github.com/remix-run/remix/releases/tag/response@0.3.2)
  - [`route-pattern@0.19.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.19.0)
  - [`session-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.1.4)
  - [`session-storage-memcache@0.1.0`](https://github.com/remix-run/remix/releases/tag/session-storage-memcache@0.1.0)
  - [`session-storage-redis@0.1.0`](https://github.com/remix-run/remix/releases/tag/session-storage-redis@0.1.0)
  - [`static-middleware@0.4.4`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.4)

## v3.0.0-alpha.2

### Pre-release Changes

- Added `package.json` `exports`:

  - `remix/route-pattern/specificity` to re-export APIs from `@remix-run/route-pattern/specificity`

- Bumped `@remix-run/*` dependencies:
  - [`async-context-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.1.2)
  - [`component@0.4.0`](https://github.com/remix-run/remix/releases/tag/component@0.4.0)
  - [`compression-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.2)
  - [`fetch-router@0.16.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.16.0)
  - [`form-data-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.1.3)
  - [`form-data-parser@0.15.0`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.15.0)
  - [`interaction@0.5.0`](https://github.com/remix-run/remix/releases/tag/interaction@0.5.0)
  - [`logger-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.1.2)
  - [`method-override-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.3)
  - [`route-pattern@0.18.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.18.0)
  - [`session-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.1.3)
  - [`static-middleware@0.4.3`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.3)

## v3.0.0-alpha.1

### Pre-release Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v3.0.0-alpha.0

### Major Changes

- Initial alpha release of `remix` package for Remix 3
