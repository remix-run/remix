# `remix` CHANGELOG

This is the changelog for [`remix`](https://github.com/remix-run/remix/tree/main/packages/remix). It follows [semantic versioning](https://semver.org/).

## v3.0.0-beta.1

### Pre-release Changes

- BREAKING CHANGE: Renamed the `remix/auth-middleware` auth context helper types from `WithAuth` and `WithRequiredAuth` to `ContextWithAuth` and `ContextWithRequiredAuth` so middleware packages consistently use the `ContextWith*` naming pattern for helpers that produce refined `RequestContext` types.

  ```ts
  // before
  type AppAuthContext = WithRequiredAuth<AppContext, AuthIdentity>

  // after
  type AppAuthContext = ContextWithRequiredAuth<AppContext, AuthIdentity>
  ```

- BREAKING CHANGE: Updated the re-exported `remix/fetch-router` helper types to match `@remix-run/fetch-router`: `Action` now describes either a plain request handler function or action object and accepts the full request context as its optional second generic, `Controller` now accepts the full request context as its optional second generic, `RequestHandler` now accepts the full request context as its only generic, `Middleware` now accepts one context effect generic, which can be a single `ContextEntry`, a `ContextEntries` tuple, or a context transform function, `BuildAction` is no longer exported, `createAction()`/`createController()` are the preferred helpers for stored handlers, `RouterTypes.context` configures the default builder context, `MiddlewareContext` now accepts an optional base context, `ContextWithMiddleware` applies middleware to an existing context, the lower-level `MiddlewareContextTransform`, `ContextTransform`, `ApplyContextTransform`, `ApplyMiddleware`, and `ApplyMiddlewareTuple` helpers are no longer exported, and custom matcher payloads should use `RouteEntry` instead of `MatchData`.

  The request context helper type renames also apply to imports from `remix/fetch-router`.

  Use `ContextWithParams` when deriving an app context that includes route params:

  ```ts
  // before
  type AppContext<params extends AnyParams = {}> = WithParams<
    MiddlewareContext<typeof middleware>,
    params
  >

  // after
  type AppContext<params extends AnyParams = {}> = ContextWithParams<
    MiddlewareContext<typeof middleware>,
    params
  >
  ```

  Use `ContextWithValues` when a middleware package provides one or more context values:

  ```ts
  // before
  export type WithCurrentUser<context extends RequestContext<any, any>> = MergeContext<
    context,
    [readonly [typeof CurrentUser, User | null]]
  >

  // after
  type CurrentUserContextEntry = ContextEntry<typeof CurrentUser, User | null>

  export type ContextWithCurrentUser<context extends RequestContext<any, any>> = ContextWithValues<
    context,
    [CurrentUserContextEntry]
  >
  ```

  If you manually annotate request handlers, pass the full request context type as the only generic:

  ```ts
  // before
  let handler: RequestHandler<{ id: string }, RequestContext<{ id: string }>>

  // after
  let handler: RequestHandler<RequestContext<{ id: string }>>
  ```

  `Action` can be used to manually annotate either action form:

  ```ts
  let handler: Action<typeof routes.account, AccountContext> = (context) => {
    return Response.json(context.get(Auth).identity)
  }

  let action: Action<typeof routes.account, AccountContext> = {
    middleware: accountMiddleware,
    handler(context) {
      return Response.json(context.get(Auth).identity)
    },
  }
  ```

  If you manually annotate middleware, pass only the context transform type:

  ```ts
  // before
  let middleware: Middleware<{}, SetDatabaseContextTransform>

  // after
  type DatabaseContextEntry = ContextEntry<typeof Database, Database>
  let middleware: Middleware<DatabaseContextEntry>
  ```

  Use `ContextWithValue` when refining a single context value for a specific handler or middleware result:

  ```ts
  // before
  type AdminContext = SetContextValue<AppContext, typeof CurrentRole, 'admin'>

  // after
  type AdminContext = ContextWithValue<AppContext, typeof CurrentRole, 'admin'>
  ```

  For most apps, augment `RouterTypes.context` once and use `createController()` instead of repeating a `satisfies Controller<...>` clause on every controller:

  ```ts
  // before
  type AuthenticatedAppContext = WithRequiredAuth<AppContext, AuthIdentity>

  let controller = {
    middleware: [requireAuth<AuthIdentity>()],
    actions: {
      account(context) {
        let auth = context.get(Auth)
        return Response.json(auth.identity)
      },
    },
  } satisfies Controller<typeof routes, AuthenticatedAppContext>

  // after
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
        let auth = context.get(Auth)
        return Response.json(auth.identity)
      },
    },
  })
  ```

- BREAKING CHANGE: Removed the `remix/fetch-router/routes` export. Import route definitions and helpers from `remix/routes` instead.

  Added `package.json` `exports`:

  - `remix/routes` to re-export APIs from `@remix-run/routes`

- BREAKING CHANGE: `remix/route-pattern` no longer exports `ArrayMatcher` or `TrieMatcher`. Use the new `createMatcher` function instead.

  ```ts
  // before
  import { ArrayMatcher } from 'remix/route-pattern'
  let matcher = new ArrayMatcher<string>()

  // after
  import { createMatcher } from 'remix/route-pattern'
  let matcher = createMatcher<string>()
  ```

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

- Fix `createMatcher` from `remix/route-pattern` so dynamic pathname segments and wildcard continuations only match when they cover the full pathname range being tested.

  ```ts
  import { createMatcher } from 'remix/route-pattern'

  let matcher = createMatcher<string>()
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
  - [`assets@0.3.1`](https://github.com/remix-run/remix/releases/tag/assets@0.3.1)
  - [`async-context-middleware@0.2.3`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.2.3)
  - [`auth@0.2.2`](https://github.com/remix-run/remix/releases/tag/auth@0.2.2)
  - [`auth-middleware@0.2.0`](https://github.com/remix-run/remix/releases/tag/auth-middleware@0.2.0)
  - [`cli@0.3.0`](https://github.com/remix-run/remix/releases/tag/cli@0.3.0)
  - [`compression-middleware@0.1.8`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.8)
  - [`cookie@0.5.2`](https://github.com/remix-run/remix/releases/tag/cookie@0.5.2)
  - [`cop-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/cop-middleware@0.1.3)
  - [`cors-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/cors-middleware@0.1.3)
  - [`csrf-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/csrf-middleware@0.1.3)
  - [`data-table-postgres@0.3.2`](https://github.com/remix-run/remix/releases/tag/data-table-postgres@0.3.2)
  - [`fetch-proxy@0.8.1`](https://github.com/remix-run/remix/releases/tag/fetch-proxy@0.8.1)
  - [`fetch-router@0.19.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.0)
  - [`form-data-middleware@0.3.0`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.3.0)
  - [`form-data-parser@0.17.1`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.17.1)
  - [`headers@0.20.0`](https://github.com/remix-run/remix/releases/tag/headers@0.20.0)
  - [`logger-middleware@0.2.2`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.2.2)
  - [`method-override-middleware@0.1.8`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.8)
  - [`multipart-parser@0.16.1`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.1)
  - [`node-serve@0.2.0`](https://github.com/remix-run/remix/releases/tag/node-serve@0.2.0)
  - [`response@0.3.4`](https://github.com/remix-run/remix/releases/tag/response@0.3.4)
  - [`route-pattern@0.21.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.21.0)
  - [`routes@0.1.0`](https://github.com/remix-run/remix/releases/tag/routes@0.1.0)
  - [`session-middleware@0.2.3`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.2.3)
  - [`static-middleware@0.4.9`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.9)
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

  - `remix/cop-middleware` exposes `cop(options)` for browser-focused cross-origin protection
    using `Sec-Fetch-Site` with `Origin` fallback, trusted origins, and configurable bypasses.
  - `remix/csrf-middleware` exposes `csrf(options)` and `getCsrfToken(context)` for
    session-backed CSRF tokens plus origin validation.
  - Apps can use either middleware independently or layer `cop()`, `session()`, and `csrf()`
    together when they want both browser-origin filtering and token-backed protection.

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
