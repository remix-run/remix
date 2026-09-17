---
name: remix
description: Builds, reviews, and refactors Remix 3 applications using the remix npm package and remix/* imports. Use when changing an application's structure, routes, controllers, middleware, validation, data, auth, sessions, uploads, UI, hydration, navigation, assets, or tests; not when implementing Remix framework packages.
---

# Build and Review a Remix App

Use this skill for Remix's framework-level mental model and app shape. Use the guides and API READMEs shipped with the installed `remix` package for task workflows, exact APIs, and recipes.

Remix 3 uses Web APIs (`Request`, `Response`, `URL`, `FormData`) and `remix/<subpath>` imports. Its UI runtime is not React: do not assume hooks, React lifecycle, or React package conventions apply.

## Framework Mental Model

A Remix app is a visible request pipeline:

```txt
runtime server → router middleware → matched route → controller action → Web Response
```

- `server.ts` adapts the host runtime to a Web `Request` and passes it to `router.fetch(request)`.
- `app/routes.ts` is the typed URL and method contract. The same route map generates URLs for links, forms, redirects, and tests.
- `app/router.ts` composes middleware and maps route branches to controllers.
- `app/actions/` owns route behavior. Each controller handles the direct route leaves mapped to it and returns a Web `Response`.
- Remix components render HTML on the server. Browser JavaScript is opt-in at explicit client-entry boundaries.

Make the server request/response path correct before adding browser enhancement. Keep runtime-specific code at the server edge and use Web APIs through the rest of the app.

## Typical App Shape

Follow the existing app first. A conventional app keeps request ownership visible in its file tree:

```txt
server.ts
app/
├── routes.ts
├── router.ts
├── assets.ts
├── middleware/
├── actions/
│   ├── controller.tsx
│   ├── document.tsx
│   └── albums/
│       ├── controller.tsx
│       ├── show-page.tsx
│       └── public/
└── ui/
```

Keep route-local controllers, data access, UI, and browser modules together under their owning `actions/<route>/` directory. Put components in `app/ui/` when multiple route areas actually share them. A colocated `public/` directory marks source that may reach the browser; server-only code must stay outside that boundary.

## One Feature Across the Stack

Define the URL contract independently from its implementation:

```ts
// app/routes.ts
import { get, route } from 'remix/routes'

export const routes = route({
  albums: {
    show: get('/albums/:albumId'),
  },
})
```

Implement the direct route leaf in the matching controller:

```tsx
// app/actions/albums/controller.tsx
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { AlbumPage } from './show-page.tsx'

export default createController(routes.albums, {
  actions: {
    show(context) {
      return context.render(<AlbumPage albumId={context.params.albumId} />)
    },
  },
})
```

Register that route branch and controller in `app/router.ts`:

```ts
router.map(routes.albums, albumsController)
```

A Remix component is a setup function that returns a render function. Read changing props from the handle during render:

```tsx
import type { Handle } from 'remix/ui'

export function AlbumPage(handle: Handle<{ albumId: string }>) {
  return () => <h1>Album {handle.props.albumId}</h1>
}
```

The route map owns the URL, the controller owns request behavior, and the component owns presentation. Middleware adds request-scoped capabilities such as rendering, sessions, or parsed form data. Read the installed guides before expanding this shape into forms, persistence, authentication, uploads, or browser interaction.

## Know the Starter Workflow

Read the app's `package.json` and use its package manager to run scripts. A generated starter distinguishes three server modes:

- `dev` runs the app in development with Node watch/restart behavior, but does not activate HMR.
- `hmr` is the development entry for live server and browser updates. Use it instead of `dev` when iterating on interactive or visual changes; Remix HMR is not active unless this entry is running.
- `start` runs the same TypeScript server and asset pipeline with `NODE_ENV=production`. The starter has no separate production build step. Production disables development behavior and enables configurable optimizations rather than introducing another application architecture. Inspect `app/assets.ts` and deployment configuration to adjust them.

Generated apps also include testing through the Remix test runner and a router smoke test that can be extended as the app grows.

The installed CLI includes `remix doctor`, which checks the project environment and Remix app conventions. Run it when entering an unfamiliar app and after structural or configuration changes. Review its findings before applying its available low-risk fixes.

## Find Canonical Documentation

1. Read the app's `AGENTS.md`, `package.json`, and `tsconfig.json`, then inspect the code that owns the behavior being changed.
2. Check the installed version in `node_modules/remix/package.json` or with the installed `remix version` command. A scaffolded skill copy may be older than the installed package.
3. Search `node_modules/remix/INDEX.md` by task, export, or keyword:

   ```sh
   grep -i 'session' node_modules/remix/INDEX.md
   ```

4. If the index lists a relevant guide, read it for the workflow and follow its links to related guides.
5. Read the relevant package README for exact imports, options, behavior, and examples. When no task guide is published yet, use the API documentation and existing app patterns rather than inventing a skill-local recipe.

Treat the installed package documentation as canonical. Do not use online documentation for a newer version, invent compatibility wrappers, or rely on remembered React or Remix 2 patterns. If an older installation has no index, inspect its `package.json` exports and matching installed documentation, source, and types directly.

## Work Within the App

- Preserve the app's package manager, scripts, runtime, route organization, middleware order, and import conventions unless the task requires changing them.
- Inspect the relevant route map, router, controller, middleware, component, browser entry, and tests before editing. Change the narrowest owner of the behavior.
- Keep secrets, credentials, persistence, authorization, and other trusted work on the server. Treat browser-module exposure and uploaded data as security boundaries.
- Prefer Web APIs, native links, buttons, and forms, plus existing first-party Remix primitives, over custom abstractions.

## Verify the Behavior

Use the app's existing scripts and installed CLI. Start with relevant tests and typechecking, then verify the changed boundary directly. Read the installed testing guide for test patterns and `node_modules/remix/src/cli/README.md` for CLI diagnostics.

For browser-enhanced behavior, test both ordinary document behavior and the enhanced path. For authentication, authorization, uploads, validation, and persistence, test rejection and failure paths as well as success.

Do not run destructive database commands or rewrite project configuration merely to make a diagnostic pass. Report what was checked and what remains unverified.
