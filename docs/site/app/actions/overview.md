Remix is a full-stack TypeScript framework built on web standards. One package covers routing, data, auth, sessions, UI, asset compilation and testing, all using Web APIs like `Request`, `Response`, streams and files.

## Quick start

Scaffold an app and start the dev server:

::frame{src="/examples/overview/install-command/"}

Then follow [Getting Started](/start-here/) for a tour of what you just created.

## Remix core concepts

- **Web APIs throughout.** Requests, responses, streams and files work the same way on the server, in middleware and in tests. HTTP is the interface between routes, middleware, assets and integrations.
- **Composable packages.** Use the whole framework or adopt focused parts independently.
- **State is just JavaScript.** A component runs setup once, then returns a function that renders JSX. Keep state in ordinary variables and objects instead of hooks.
- **Updates are explicit.** Your code decides when the UI renders by calling `handle.update()` after changing state.
- **Behavior attaches to elements.** Mixins add events, styles, refs and accessibility to an element without wrapping it in another component.
- **Client boundaries are visible.** You choose which components hydrate, and `Frame` updates regions of a page with server-rendered HTML.
- **No application build step.** TypeScript, JSX and CSS compile when requested and are served as native modules, so the browser caches each one independently.

## Working with agents

Remix is designed so people and coding agents can trace how an app works: standard Web APIs, explicit updates and ordinary source modules. To help agents get the details right, Remix provides a [`remix` skill](https://github.com/remix-run/remix/blob/main/.agents/skills/remix/SKILL.md). It teaches an agent Remix's mental model and conventions, and tells it to read the documentation installed in `node_modules/remix` rather than rely on memory of older Remix versions.

- **Installed docs.** The `remix` package ships `INDEX.md`, the [guides](/start-here/) as Markdown, and each module's README and source. An agent can search them by task or export, for example `grep -i 'session' node_modules/remix/INDEX.md`.
- **Markdown pages.** Every guide and API page here is also available as Markdown by adding `.md` to its URL, for example [`/start-here.md`](/start-here.md).
- **Starter apps.** Apps created with `npx remix new` include the skill, so agents can use it without extra setup. For an existing app, copy [`.agents/skills/remix`](https://github.com/remix-run/remix/tree/main/.agents/skills/remix) into the project.

When you ask an agent to change a Remix app, point it at the skill and the relevant guide, and ask it to follow the existing patterns in your code.

## What's in Remix

Each feature is its own module, imported from `remix/*`. Use them together or adopt one at a time. Every area below links to the guides that explain it and the API modules that document it.

### Server

Route standard Web Requests through typed middleware and controllers, then return standard Responses for HTML, JSON, redirects, files and streams.

Guides: [Routing and Controllers](/routing-and-controllers/) and [Request Handling](/request-handling/). API: [`router`](/api/router/), [`routes`](/api/routes/) and [`middleware`](/api/middleware/).

### Data

Connect to SQLite, PostgreSQL or MySQL. Define schemas, run migrations, compose queries and validate input with one type-safe set of tools.

Guides: [Data and Validation](/data-and-validation/) and [Forms and Mutations](/forms-and-mutations/). API: [`data-table`](/api/data-table/) and [`data-schema`](/api/data-schema/).

### Auth and sessions

Authenticate users with credentials or external providers, resolve each request to a typed identity, protect routes with middleware and keep session data on the server behind a signed cookie.

Guides: [Auth, Sessions, and Security](/auth-sessions-security/). API: [`auth`](/api/auth/) and [`session`](/api/session/).

### Files and assets

Serve static files, accept bounded uploads and store files on disk, in memory or in S3. Compile TypeScript, JavaScript and CSS on demand and serve them as native browser modules, with hot reloading in development.

Guides: [Files and Assets](/files-and-assets/). API: [`assets`](/api/assets/), [`file-storage`](/api/file-storage/) and [`form-data-parser`](/api/form-data-parser/).

### Components

Render JSX components on the server and hydrate the ones you mark as client entries. Update independent regions of a page with `Frame`, or run your whole UI in the browser.

Guides: [Rendering UI](/rendering-ui/), [Interactivity](/interactivity/) and [Streaming UI with Frames](/streaming-ui-with-frames/). API: [`component`](/api/component/).

### UI and animation

Compose unstyled, accessible primitives with your own markup and CSS. `@remix-run/ui` handles focus, keyboard navigation, selection, dismissal and ARIA, and ships mixins for animating elements as they enter, exit, move and resize.

Guides: [Animation](/animation/). API: [`ui`](/api/ui/). Remix UI is versioned separately and imported from `@remix-run/ui/*`.

### Testing and tooling

Run tests, assert with `node:assert`-compatible helpers and an `expect` API, and drive it all from the `remix` command.

Guides: [Testing](/testing/) and [CLI and Tooling](/cli-and-tooling/). API: [`test`](/api/test/) and [`cli`](/api/cli/).
