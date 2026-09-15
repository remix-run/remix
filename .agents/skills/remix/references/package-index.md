# Package Index

Read when you know what you need but not which `remix/*` export provides it. Each line says what the export is for; the installed README (see "Find Package Documentation" in `SKILL.md`) owns signatures and examples. Confirm an export exists in `node_modules/remix/package.json` before importing it; this list tracks the version the skill was written against.

## Routing, server, and responses

| Export                    | Use for                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `remix/router`            | `createRouter`, `createController`, `createAction`, `createMiddleware`, `createContextKey`, and the `Middleware`/context types       |
| `remix/routes`            | Route-map builders for `app/routes.ts`: `route`, `get`, `post`, `put`, `del`, `form`, `resources`                                    |
| `remix/route-pattern`     | Low-level URL pattern matching and `href` generation outside the router (`/href`, `/match`, `/join`, `/specificity` subpaths)        |
| `remix/response/redirect` | `redirect(href, status?)` for POST-redirect-GET and other location changes                                                           |
| `remix/response/html`     | `createHtmlResponse` for an HTML `Response` from a string or stream without Remix UI                                                 |
| `remix/response/file`     | File-download responses with `Content-Disposition`                                                                                   |
| `remix/response/compress` | `compressResponse` for one-off compression outside `compression()` middleware                                                        |
| `remix/headers`           | `SuperHeaders` (typed `Headers` subclass) plus per-header classes under `remix/headers/<name>` such as `cache-control`, `set-cookie` |
| `remix/node-fetch-server` | `createRequestListener` to run a fetch handler on `node:http`/`https`/`http2`; `/test` exports `createTestServer`                    |
| `remix/fetch-proxy`       | Forward a request to another origin with forwarded-header and cookie rewriting                                                       |
| `remix/spa`               | Intentionally browser-only routing; read its README before choosing it over server routes                                            |
| `remix/node-tsx`          | Node `--import` hook that runs `.ts`/`.tsx` sources directly (used by the scaffold's scripts)                                        |

## Middleware

| Export                             | Use for                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `remix/middleware/render`          | `render({ assets, onError })` so actions can `context.render(node, init)`; `renderWith` for custom |
| `remix/middleware/static`          | `staticFiles(dir)` for root `public/` files served as-is                                           |
| `remix/middleware/form-data`       | `formData(options?)` to parse the body once and expose `context.get(FormData)`                     |
| `remix/middleware/method-override` | `methodOverride()` so HTML forms can send `PUT`/`PATCH`/`DELETE`                                   |
| `remix/middleware/session`         | `session(cookie, storage)` to load/commit a session and emit `Set-Cookie`                          |
| `remix/middleware/auth`            | `auth({ schemes })`, `requireAuth()`, and the `Auth` context key                                   |
| `remix/middleware/csrf`            | `csrf(options?)` synchronizer tokens and `getCsrfToken(context)` for session-backed forms          |
| `remix/middleware/cop`             | Cross-origin protection that rejects unsafe cross-origin browser requests                          |
| `remix/middleware/cors`            | `cors(options?)` for endpoints intentionally called cross-origin                                   |
| `remix/middleware/compression`     | `compression()` for text-like responses                                                            |
| `remix/middleware/logger`          | `logger()` request logs in development                                                             |
| `remix/middleware/async-context`   | `asyncContext()` plus `getContext()` for helpers that need request context without threading it    |

## Data, validation, and persistence

| Export                         | Use for                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `remix/data-schema`            | Schema builders, `parse`, `parseSafe`, `.pipe`, `.transform`, `defaulted`                                |
| `remix/data-schema/form-data`  | `f.object`, `f.field`, `f.fields`, `f.file`, `f.files` for `FormData`/`URLSearchParams`                  |
| `remix/data-schema/checks`     | Composable checks such as `email`, `minLength`, `maxLength`                                              |
| `remix/data-schema/coerce`     | String-to-`number`/`boolean`/`date`/`bigint` coercion for form and query input                           |
| `remix/data-schema/lazy`       | Recursive or mutually referential schemas                                                                |
| `remix/data-table`             | `table`, `column`, and the shared `Database` API (`findMany`, `create`, transactions, hooks)             |
| `remix/data-table/sqlite`      | `createSqliteDatabase` (Node/Bun built-in SQLite or compatible sync clients); also `/postgres`, `/mysql` |
| `remix/data-table/operators`   | `where` operators such as `inList`                                                                       |
| `remix/data-table/migrations`  | `createMigration`, `createMigrationRegistry`; `/node` adds `loadMigrations` from disk                    |
| `remix/data-table/sql-helpers` | SQL utilities for driver/integration authors, not ordinary app code                                      |
| `remix/data-table/cli`         | Programmatic `remix db` support; apps normally use the CLI and `remix.json`                              |

## Sessions, cookies, and auth

| Export                         | Use for                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `remix/session`                | The `Session` object: `get`, `set`, `flash`, `unset`, `regenerateId`, `destroy`, plus storage types                                           |
| `remix/session-storage/memory` | Test and single-process storage                                                                                                               |
| `remix/session-storage/fs`     | Filesystem storage for single-host apps                                                                                                       |
| `remix/session-storage/cookie` | Stateless storage when session data fits in a cookie                                                                                          |
| `remix/session-storage/redis`  | Shared storage for multi-host deployments; `/memcache` is the Memcache equivalent                                                             |
| `remix/cookie`                 | `createCookie` for plain signed/unsigned cookies where the client may control the value                                                       |
| `remix/auth`                   | Credentials, OAuth, and OIDC providers: `verifyCredentials`, `startExternalAuth`, `finishExternalAuth`, `completeAuth`, `refreshExternalAuth` |

## Uploads and files

| Export                   | Use for                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `remix/form-data-parser` | `parseFormData(request, options, uploadHandler?)` and `FileUpload` with size/count limits |
| `remix/multipart-parser` | Low-level multipart stream parsing; `/node` for Node streams                              |
| `remix/file-storage`     | Backend-agnostic `FileStorage` interface; `/fs`, `/memory`, `/s3` implement it            |
| `remix/lazy-file`        | `LazyFile` and byte-range helpers beneath the file response helpers                       |
| `remix/fs`               | Node helpers such as `openLazyFile` and `writeFile`                                       |
| `remix/mime`             | Content-type detection instead of an app-local extension map                              |
| `remix/tar-parser`       | Streaming tar parsing for import/export tooling                                           |

## UI, hydration, and browser assets

| Export                 | Use for                                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `remix/ui`             | Components (`Handle`), core mixins (`on`, `css`, `ref`, `link`, `attrs`, `createMixin`), `clientEntry`, `run`, `Frame`, `createRoot`                                                                     |
| `remix/ui/server`      | `renderToStream`/`renderToString` for custom pipelines; normal apps use `remix/middleware/render`                                                                                                        |
| `remix/ui/animation`   | `animateEntrance`, `animateExit`, `animateLayout`, `spring`, `tween`, `easings`                                                                                                                          |
| `remix/ui/<primitive>` | Styled controls: `accordion`, `anchor`, `breadcrumbs`, `button`, `checkbox`, `combobox`, `input`, `listbox`, `menu`, `popover`, `radio`, `select`, `tabs`, `toggle`; `/primitives` subpaths are headless |
| `remix/ui/test`        | `render(...)` for browser component tests (`$`, `$$`, `act`, `cleanup`)                                                                                                                                  |
| `remix/ui/jsx-runtime` | JSX transform target configured in `tsconfig.json`; not imported directly                                                                                                                                |
| `remix/html-template`  | Escaped HTML template literals for HTML generated outside the component system                                                                                                                           |
| `remix/assets`         | `createAssetServer` for compiled browser modules, `getHref`, `getPreloads`, access rules; `/types/hmr` types `import.meta.hot`                                                                           |
| `remix/node-hmr`       | Development supervisor (`run`, `createHmrReadyFetch`); `/runtime` for the child process; `/types` for `import.meta.hot` in Node                                                                          |
| `remix/ui-hmr`         | Component HMR transforms: `/node` import hook, `/assets` loader (`uiHmr()`), `/runtime/*` internals                                                                                                      |
| `remix/ui/dev/refresh` | Development refresh internals used by HMR tooling, not app code                                                                                                                                          |

## Testing and tooling

| Export           | Use for                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `remix/test`     | `describe`, `it`, lifecycle hooks, mocks, and fake timers; run with `remix test` |
| `remix/assert`   | Assertions whose failures render cleanly in the runner                           |
| `remix/test/cli` | Programmatic runner API (`runRemixTest`)                                         |
| `remix/terminal` | ANSI styles, color detection, and testable terminal streams for CLIs             |
