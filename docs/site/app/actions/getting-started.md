Remix is a full-stack TypeScript framework for building fast, secure web applications using web standards.

These docs have two parts:

- The guides explain how Remix works and show how its pieces fit together in a complete app. If you are new to Remix, begin with [Getting Started](/guides/start-here/).
- The API reference below documents individual modules, functions and types. Use it when you know what feature you want to look up.

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

## API reference

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
