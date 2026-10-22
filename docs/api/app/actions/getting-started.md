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

- [`router`](/router/): handle requests with routes, controllers and middleware on the Fetch API
- [`routes`](/routes/): define typed route maps for routers, links and forms
- [`route-pattern`](/route-pattern/): match and generate URLs with strong typing
- [`middleware`](/middleware/): sessions, auth, CSRF, CORS, compression, static files, logging and more
- [`response`](/response/): helpers for HTML, file, redirect and compressed responses
- [`headers`](/headers/): typed classes for parsing and building HTTP headers
- [`cookie`](/cookie/): type-safe cookie parsing and serialization, with signing
- [`fetch-proxy`](/fetch-proxy/): forward requests to another server
- [`node-fetch-server`](/node-fetch-server/): run a Fetch API handler on Node's HTTP server

### UI

- [`component`](/component/): components that render on the server and hydrate in the browser
- [`ui`](/ui/): headless, accessible UI primitives and animation utilities
- [`spa`](/spa/): client-rendered application routing
- [`assets`](/assets/): compile browser JavaScript, TypeScript and CSS on demand
- [`html-template`](/html-template/): HTML template literals with automatic escaping
- [`component-hmr`](/component-hmr/): hot module replacement for components
- [`multiple-import-maps-polyfill`](/multiple-import-maps-polyfill/): support import maps added after the page loads

### Data and validation

- [`data-schema`](/data-schema/): tiny, standards-aligned schema validation
- [`data-table`](/data-table/): typed relational queries and migrations for MySQL, PostgreSQL and SQLite

### Sessions and auth

- [`session`](/session/): server-side session management
- [`session-storage`](/session-storage/): cookie, filesystem, memory, Memcache and Redis session storage
- [`auth`](/auth/): credential, OAuth and OIDC login flows

### Files and uploads

- [`form-data-parser`](/form-data-parser/): stream file uploads instead of buffering them in memory
- [`multipart-parser`](/multipart-parser/): fast streaming multipart parsing
- [`file-storage`](/file-storage/): key/value storage for `File` objects, on disk, in memory or in S3
- [`lazy-file`](/lazy-file/): lazy, streaming `Blob` and `File` objects
- [`fs`](/fs/): read local files as lazy, streaming `File` objects
- [`mime`](/mime/): MIME type detection and content-type helpers
- [`tar-parser`](/tar-parser/): streaming tar archive parsing

### Tooling and testing

- [`cli`](/cli/): the `remix` command for creating apps, running migrations, listing routes and running tests
- [`test`](/test/): a test framework for JavaScript and TypeScript
- [`assert`](/assert/): `node:assert`-compatible assertions and an `expect` API for any environment
- [`node-tsx`](/node-tsx/): run Node.js with TypeScript and JSX support
- [`node-hmr`](/node-hmr/): run Node.js apps with hot module reloading
- [`terminal`](/terminal/): ANSI styles and output helpers for command-line tools
