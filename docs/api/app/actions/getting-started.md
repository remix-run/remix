Remix is a full-stack TypeScript framework for building web applications on web standards. This reference documents every public export, grouped by the package you import it from.

New to Remix? Start with the [guides](https://guides.remix.run/), then come back here for the details of a specific API.

## Installation

```sh
npm i remix
```

To create a new app, run:

```sh
npx remix new my-remix-app
```

## Imports

Remix ships as one `remix` package, and each feature has its own import path:

```ts
import { createRouter } from 'remix/router'
import { route } from 'remix/routes'
import { css } from 'remix/component'
```

The sidebar follows those import paths. `data-table` is `remix/data-table`, and its `data-table/postgres` heading is `remix/data-table/postgres`. Each package also works on its own, outside of a Remix app.

Remix UI is the exception. It's versioned separately and imported from `@remix-run/ui/*`.

## Packages

### Routing and requests

- [`router`](/remix/router/): handle requests with routes, controllers and middleware on the Fetch API
- [`routes`](/remix/routes/): define typed route maps for routers, links and forms
- [`route-pattern`](/remix/route-pattern/): match and generate URLs with strong typing
- [`middleware`](/remix/middleware/): sessions, auth, CSRF, CORS, compression, static files, logging and more
- [`response`](/remix/response/): helpers for HTML, file, redirect and compressed responses
- [`headers`](/remix/headers/): typed classes for parsing and building HTTP headers
- [`cookie`](/remix/cookie/): type-safe cookie parsing and serialization, with signing
- [`fetch-proxy`](/remix/fetch-proxy/): forward requests to another server
- [`node-fetch-server`](/remix/node-fetch-server/): run a Fetch API handler on Node's HTTP server

### UI

- [`component`](/remix/component/): components that render on the server and hydrate in the browser
- [`ui`](/remix-run/ui/): headless, accessible UI primitives and animation utilities
- [`spa`](/remix/spa/): client-rendered application routing
- [`assets`](/remix/assets/): compile browser JavaScript, TypeScript and CSS on demand
- [`html-template`](/remix/html-template/): HTML template literals with automatic escaping
- [`component-hmr`](/remix/component-hmr/): hot module replacement for components
- [`multiple-import-maps-polyfill`](/remix/multiple-import-maps-polyfill/): support import maps added after the page loads

### Data and validation

- [`data-schema`](/remix/data-schema/): tiny, standards-aligned schema validation
- [`data-table`](/remix/data-table/): typed relational queries and migrations for MySQL, PostgreSQL and SQLite

### Sessions and auth

- [`session`](/remix/session/): server-side session management
- [`session-storage`](/remix/session-storage/): cookie, filesystem, memory, Memcache and Redis session storage
- [`auth`](/remix/auth/): credential, OAuth and OIDC login flows

### Files and uploads

- [`form-data-parser`](/remix/form-data-parser/): stream file uploads instead of buffering them in memory
- [`multipart-parser`](/remix/multipart-parser/): fast streaming multipart parsing
- [`file-storage`](/remix/file-storage/): key/value storage for `File` objects, on disk, in memory or in S3
- [`lazy-file`](/remix/lazy-file/): lazy, streaming `Blob` and `File` objects
- [`fs`](/remix/fs/): read local files as lazy, streaming `File` objects
- [`mime`](/remix/mime/): MIME type detection and content-type helpers
- [`tar-parser`](/remix/tar-parser/): streaming tar archive parsing

### Tooling and testing

- [`cli`](/remix/cli/): the `remix` command for creating apps, running migrations, listing routes and running tests
- [`test`](/remix/test/): a test framework for JavaScript and TypeScript
- [`assert`](/remix/assert/): `node:assert`-compatible assertions and an `expect` API for any environment
- [`node-tsx`](/remix/node-tsx/): run Node.js with TypeScript and JSX support
- [`node-hmr`](/remix/node-hmr/): run Node.js apps with hot module reloading
- [`terminal`](/remix/terminal/): ANSI styles and output helpers for command-line tools
