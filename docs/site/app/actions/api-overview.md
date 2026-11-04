The API reference documents every Remix module, function and type. Use it when you know what you want to look up. To learn how the pieces fit together, start with the [guides](/start-here/).

## Installation

Remix is available on [npm](https://www.npmjs.com/package/remix):

```sh
npm i remix
```

## Imports

Each feature in Remix is available in its own module:

```ts
import { createRouter } from 'remix/router'
import { route } from 'remix/routes'
import { css } from 'remix/component'
```

The API Reference uses the same module names without the `remix/` prefix. For example, `router` documents `remix/router`.

Remix UI is versioned separately and imported from `@remix-run/ui/*`.

## Modules

### Routing and requests

- [`router`](/api/router/): handle requests with routes, controllers and middleware on the Fetch API
- [`routes`](/api/routes/): define typed route maps for routers, links and forms
- [`route-pattern`](/api/route-pattern/): match and generate URLs with strong typing
- [`middleware`](/api/middleware/): sessions, auth, CSRF, CORS, compression, static files, logging and more
- [`response`](/api/response/): helpers for HTML, file, redirect and compressed responses
- [`headers`](/api/headers/): typed classes for parsing and building HTTP headers
- [`cookie`](/api/cookie/): type-safe cookie parsing and serialization, with signing
- [`fetch-proxy`](/api/fetch-proxy/): forward requests to another server
- [`node-fetch-server`](/api/node-fetch-server/): run a Fetch API handler on Node's HTTP server

### UI

- [`component`](/api/component/): components that render on the server and hydrate in the browser
- [`ui`](/api/ui/): headless, accessible UI primitives and animation utilities
- [`spa`](/api/spa/): client-rendered application routing
- [`assets`](/api/assets/): compile browser JavaScript, TypeScript and CSS on demand
- [`html-template`](/api/html-template/): HTML template literals with automatic escaping
- [`component-hmr`](/api/component-hmr/): hot module replacement for components
- [`multiple-import-maps-polyfill`](/api/multiple-import-maps-polyfill/): support import maps added after the page loads

### Data and validation

- [`data-schema`](/api/data-schema/): tiny, standards-aligned schema validation
- [`data-table`](/api/data-table/): typed relational queries and migrations for MySQL, PostgreSQL and SQLite

### Sessions and auth

- [`session`](/api/session/): server-side session management
- [`session-storage`](/api/session-storage/): cookie, filesystem, memory, Memcache and Redis session storage
- [`auth`](/api/auth/): credential, OAuth and OIDC login flows

### Files and uploads

- [`form-data-parser`](/api/form-data-parser/): stream file uploads instead of buffering them in memory
- [`multipart-parser`](/api/multipart-parser/): fast streaming multipart parsing
- [`file-storage`](/api/file-storage/): key/value storage for `File` objects, on disk, in memory or in S3
- [`lazy-file`](/api/lazy-file/): lazy, streaming `Blob` and `File` objects
- [`fs`](/api/fs/): read local files as lazy, streaming `File` objects
- [`mime`](/api/mime/): MIME type detection and content-type helpers
- [`tar-parser`](/api/tar-parser/): streaming tar archive parsing

### Tooling and testing

- [`cli`](/api/cli/): the `remix` command for creating apps, running migrations, listing routes and running tests
- [`test`](/api/test/): a test framework for JavaScript and TypeScript
- [`assert`](/api/assert/): `node:assert`-compatible assertions and an `expect` API for any environment
- [`node-tsx`](/api/node-tsx/): run Node.js with TypeScript and JSX support
- [`node-hmr`](/api/node-hmr/): run Node.js apps with hot module reloading
- [`terminal`](/api/terminal/): ANSI styles and output helpers for command-line tools
