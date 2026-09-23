# Remix Documentation Index

Search this generated index by task, export name, or description. Use the guides for app workflows and the package READMEs for API details that match the installed Remix version.

## Guides

| Guide | Description |
| --- | --- |
| [Start Here](guides/01-start-here.md) | A high-level introduction to Remix and the mental model behind a Remix application. |
| [Routing and Controllers](guides/02-routing-and-controllers.md) | How route maps, route helpers, controllers, actions, and responses define Remix request handling. |
| [Request Handling](guides/03-request-handling.md) | How a Web Request becomes a Web Response across runtime adapters and the middleware pipeline. |
| [Rendering UI](guides/04-rendering-ui.md) | How to build pages from Remix components, props, context, document shells, styles, and first-party UI. |
| [Interactivity](guides/05-interactivity.md) | How server-rendered UI hydrates, handles events, connects components to application models, navigates, and cancels stale work. |
| [Streaming UI with Frames](guides/06-streaming-ui-with-frames.md) | How to stream and reload route-owned UI with Frame, fallbacks, and server and browser frame resolvers. |
| [Animation](guides/07-animation.md) | The CSS-first animation model and Remix UI helpers for motion that respects rendering state. |
| [Testing](guides/13-testing.md) | How to choose a test boundary and test Remix routes, stateful request flows, components, and end-to-end behavior. |

## Package APIs

Exports covered by the same README are grouped together.

| Exports | Description | Docs |
| --- | --- | --- |
| `remix/assert` | Node assert-compatible utilities for any JavaScript environment | [README](src/assert/README.md) |
| `remix/assets`<br>`remix/assets/types/hmr` | Fetch-based server for compiling browser JS/TS and CSS assets on demand | [README](src/assets/README.md) |
| `remix/auth` | Browser login, OAuth, and OIDC helpers for Remix | [README](src/auth/README.md) |
| `remix/cookie` | A toolkit for working with cookies in JavaScript | [README](src/cookie/README.md) |
| `remix/data-schema`<br>`remix/data-schema/checks`<br>`remix/data-schema/coerce`<br>`remix/data-schema/form-data`<br>`remix/data-schema/lazy` | Tiny, standards-aligned schema validation | [README](src/data-schema/README.md) |
| `remix/data-table`<br>`remix/data-table/cli`<br>`remix/data-table/migrations`<br>`remix/data-table/migrations/node`<br>`remix/data-table/operators`<br>`remix/data-table/sql-helpers` | A typed, relational query toolkit for JavaScript | [README](src/data-table/README.md) |
| `remix/data-table/mysql` | MySQL database implementation for remix/data-table | [README](src/data-table-mysql/README.md) |
| `remix/data-table/postgres` | PostgreSQL database implementation for remix/data-table | [README](src/data-table-postgres/README.md) |
| `remix/data-table/sqlite` | SQLite database implementation for remix/data-table | [README](src/data-table-sqlite/README.md) |
| `remix/fetch-proxy` | An HTTP proxy for the web Fetch API | [README](src/fetch-proxy/README.md) |
| `remix/file-storage`<br>`remix/file-storage/fs`<br>`remix/file-storage/memory` | Key/value storage for JavaScript File objects | [README](src/file-storage/README.md) |
| `remix/file-storage/s3` | S3 backend for remix/file-storage | [README](src/file-storage-s3/README.md) |
| `remix/form-data-parser` | A request.formData() wrapper with streaming file upload handling | [README](src/form-data-parser/README.md) |
| `remix/fs` | Filesystem utilities using the Web File API | [README](src/fs/README.md) |
| `remix/headers`<br>`remix/headers/accept`<br>`remix/headers/accept-encoding`<br>`remix/headers/accept-language`<br>`remix/headers/cache-control`<br>`remix/headers/content-disposition`<br>`remix/headers/content-range`<br>`remix/headers/content-type`<br>`remix/headers/cookie`<br>`remix/headers/if-match`<br>`remix/headers/if-none-match`<br>`remix/headers/if-range`<br>`remix/headers/range`<br>`remix/headers/raw-headers`<br>`remix/headers/set-cookie`<br>`remix/headers/vary` | A toolkit for working with HTTP headers in JavaScript | [README](src/headers/README.md) |
| `remix/html-template` | HTML template tag with auto-escaping for JavaScript | [README](src/html-template/README.md) |
| `remix/lazy-file` | Lazy, streaming files for JavaScript | [README](src/lazy-file/README.md) |
| `remix/middleware/async-context` | Middleware for storing request context in AsyncLocalStorage | [README](src/async-context-middleware/README.md) |
| `remix/middleware/auth` | Pluggable authentication middleware for Remix | [README](src/auth-middleware/README.md) |
| `remix/middleware/compression` | Middleware for compressing HTTP responses | [README](src/compression-middleware/README.md) |
| `remix/middleware/cop` | Middleware for tokenless cross-origin protection in Fetch API servers | [README](src/cop-middleware/README.md) |
| `remix/middleware/cors` | Middleware for handling CORS in Fetch API servers | [README](src/cors-middleware/README.md) |
| `remix/middleware/csrf` | Middleware for CSRF protection in Fetch API servers | [README](src/csrf-middleware/README.md) |
| `remix/middleware/form-data` | Middleware for parsing FormData from request bodies | [README](src/form-data-middleware/README.md) |
| `remix/middleware/logger` | Middleware for logging HTTP requests and responses | [README](src/logger-middleware/README.md) |
| `remix/middleware/method-override` | Middleware for overriding HTTP request methods from form data | [README](src/method-override-middleware/README.md) |
| `remix/middleware/render` | Conventional Remix UI and custom request-scoped render middleware | [README](src/render-middleware/README.md) |
| `remix/middleware/session` | Middleware for managing sessions with cookie-based storage | [README](src/session-middleware/README.md) |
| `remix/middleware/static` | Middleware for serving static files from the filesystem | [README](src/static-middleware/README.md) |
| `remix/mime` | Utilities for working with MIME types | [README](src/mime/README.md) |
| `remix/multipart-parser`<br>`remix/multipart-parser/node` | A fast, efficient parser for multipart streams in any JavaScript environment | [README](src/multipart-parser/README.md) |
| `remix/multiple-import-maps-polyfill` | Polyfill for dynamic JavaScript imports that depend on import maps added at runtime | [README](src/multiple-import-maps-polyfill/README.md) |
| `remix/node-fetch-server`<br>`remix/node-fetch-server/test` | Build servers for Node.js using the web fetch API | [README](src/node-fetch-server/README.md) |
| `remix/node-hmr`<br>`remix/node-hmr/runtime`<br>`remix/node-hmr/types` | Run Node.js applications with Hot Module Reloading | [README](src/node-hmr/README.md) |
| `remix/node-tsx`<br>`remix/node-tsx/load-module` | Run Node.js with TypeScript and JSX syntax support | [README](src/node-tsx/README.md) |
| `remix/response/compress`<br>`remix/response/file`<br>`remix/response/html`<br>`remix/response/redirect` | Response helpers for the web Fetch API | [README](src/response/README.md) |
| `remix/route-pattern`<br>`remix/route-pattern/href`<br>`remix/route-pattern/join`<br>`remix/route-pattern/match`<br>`remix/route-pattern/specificity` | Match and generate URLs with strong typing | [README](src/route-pattern/README.md) |
| `remix/router`<br>`remix/routes` | A minimal, composable router for the web Fetch API | [README](src/fetch-router/README.md) |
| `remix/session`<br>`remix/session-storage/cookie`<br>`remix/session-storage/fs`<br>`remix/session-storage/memory` | Session management for JavaScript | [README](src/session/README.md) |
| `remix/session-storage/memcache` | Memcache session storage for remix/session | [README](src/session-storage-memcache/README.md) |
| `remix/session-storage/redis` | Redis session storage for remix/session | [README](src/session-storage-redis/README.md) |
| `remix/spa` | Client-rendered application routing for Remix | [README](src/spa/README.md) |
| `remix/tar-parser` | A fast, efficient parser for tar streams in any JavaScript environment | [README](src/tar-parser/README.md) |
| `remix/terminal` | Terminal output utilities for JavaScript libraries and CLIs | [README](src/terminal/README.md) |
| `remix/test`<br>`remix/test/cli` | A test framework for JavaScript and TypeScript projects | [README](src/test/README.md) |
| `remix/ui`<br>`remix/ui/dev/refresh`<br>`remix/ui/jsx-dev-runtime`<br>`remix/ui/jsx-runtime` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/README.md) |
| `remix/ui-hmr`<br>`remix/ui-hmr/assets`<br>`remix/ui-hmr/node`<br>`remix/ui-hmr/runtime/browser`<br>`remix/ui-hmr/runtime/server` | Hot module replacement runtime and transforms for Remix UI components | [README](src/ui-hmr/README.md) |
| `remix/ui/accordion`<br>`remix/ui/accordion/primitives` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/accordion/README.md) |
| `remix/ui/anchor` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/anchor/README.md) |
| `remix/ui/animation` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/animation/README.md) |
| `remix/ui/breadcrumbs` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/breadcrumbs/README.md) |
| `remix/ui/button` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/button/README.md) |
| `remix/ui/checkbox` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/checkbox/README.md) |
| `remix/ui/combobox`<br>`remix/ui/combobox/primitives` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/combobox/README.md) |
| `remix/ui/input` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/input/README.md) |
| `remix/ui/listbox` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/listbox/README.md) |
| `remix/ui/menu`<br>`remix/ui/menu/primitives` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/menu/README.md) |
| `remix/ui/popover` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/popover/README.md) |
| `remix/ui/radio` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/radio/README.md) |
| `remix/ui/select`<br>`remix/ui/select/primitives` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/select/README.md) |
| `remix/ui/server` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/server/README.md) |
| `remix/ui/tabs`<br>`remix/ui/tabs/primitives` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/tabs/README.md) |
| `remix/ui/test` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/test/README.md) |
| `remix/ui/toggle`<br>`remix/ui/toggle/primitives` | UI runtime, headless primitives, and styled components for Remix | [README](src/ui/toggle/README.md) |
