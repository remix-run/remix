---
title: Start Here
description: A high-level introduction to Remix and the mental model behind a Remix application.
---

## What is Remix? {#what-is-remix}

Remix is a TypeScript framework built around the web's request and response model. A server receives a Web `Request`, Remix matches it to a typed route, a controller handles the request, and the app returns a Web `Response`.

The `remix` package gives you the full stack: a server adapter, fetch router, typed routes, middleware, controllers, response helpers, and testing utilities. On the UI side, it includes server-rendered components, frames for partial UI, browser-loaded client entries, client navigation, CSS-first animation helpers, source-served assets, and first-party primitives such as menus, popovers, listboxes, selects, and tabs.

Later chapters use the same package for form parsing and validation, cookies and sessions, credentials auth, OAuth/OIDC, CSRF/CORS/COP protection, file uploads, and database queries, transactions, and migrations.

Each piece of `remix` is also designed to stand on its own, so you can use the full framework or adopt smaller pieces when an app only needs routing, UI, API endpoints, auth, database access, or browser behavior.

The design of Remix comes from six core principles:

1. **Agent-First Development.** Remix optimizes source code, documentation, tooling, and abstractions for LLMs, and provides primitives for using models inside the products you build.
2. **Build on Web APIs.** Remix builds on `Request`, `Response`, `URL`, `FormData`, headers, cookies, and JavaScript because shared platform APIs reduce context switching across the full stack while keeping your application portable.
3. **Religiously Runtime.** Remix APIs do not depend on bundlers, type generation, or static analysis. Routes, middleware, controllers, and tests should run as ordinary runtime code.
4. **Avoid Dependencies.** Remix chooses dependencies carefully, wraps them behind its own boundaries, and works toward replacing them with focused packages when the framework needs long-term control.
5. **Demand Composition.** Remix packages are single-purpose, replaceable, and useful on their own. You can add or remove pieces as an app changes, while tightly coupled modules belong together.
6. **Distribute Cohesively.** Remix keeps the ecosystem easy to learn and use by distributing the composable pieces through one `remix` package and one documentation path.

The fastest way to understand Remix is to build the request path once: create a server, define routes, connect a router, and return a response.

## Quickstart: create and run a Remix app {#quickstart-create-and-run-a-remix-app}

A minimal Remix app is just a Node server that forwards `Request` objects to a router. The router returns ordinary `Response` objects.

```sh
mkdir hello-remix
cd hello-remix
npm init -y
npm i remix
```

The app entry wires Node's HTTP server to Remix's fetch-based request listener:

```ts
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { router } from './app/router.ts'

http.createServer(createRequestListener((request) => router.fetch(request))).listen(3000)
```

The frame below is loaded from a separate Remix route. Press the button to re-fetch only the frame, not the page.

:::frame /docs/examples/start-here/server-clock
:::

## Project tour: server.ts, app/routes.ts, app/router.ts, actions, UI, assets {#project-tour-server-ts-app-routes-ts-app-router-ts-actions-ui-assets}

A Remix app keeps the HTTP contract, handlers, and UI intentionally close:

- `server.ts` adapts your host runtime to Web `Request` and `Response` objects.
- `app/routes.ts` defines the typed URL contract and generates hrefs.
- `app/router.ts` installs middleware and maps route definitions to controllers.
- `app/actions/**` holds controllers, route actions, and route-local UI/helpers.
- `app/ui/**` holds shared server-rendered UI.
- `app/assets/**` holds browser-loaded client entries.

The route contract is plain TypeScript:

```ts
import { get, route } from 'remix/routes'

export const routes = route({
  home: get('/'),
  docs: route('docs', {
    index: get('/'),
    startHere: get('start-here'),
  }),
})
```

Use `routes.docs.startHere.href()` in redirects, anchors, tests, and frame sources when the URL is authored in TypeScript.

## The core model: Request, middleware, router, controller, Response {#the-core-model-request-middleware-router-controller-response}

Remix keeps the request path explicit:

1. The server receives an HTTP request and creates a Web `Request`.
2. Middleware can serve static files, parse form data, attach sessions, or add a renderer.
3. The router matches the request to a typed route.
4. The controller reads params, context, and request data.
5. The controller returns a Web `Response`.

A page handler can be as small as rendering a component tree:

```tsx
import type { Handle } from 'remix/ui'

import type { AppContext } from '../router.ts'

export async function homeHandler({ render }: AppContext) {
  return render(<HomePage name="Ada" />)
}

function HomePage(handle: Handle<{ name: string }>) {
  return () => <h1>Hello, {handle.props.name}</h1>
}
```

Because the route returns a normal `Response`, it is easy to test with `router.fetch(new Request(url))`.

## Build your first page {#build-your-first-page}

A Remix UI component is a function that receives a `handle` and returns a render function. It is not React, but the JSX authoring shape stays familiar.

```tsx
import type { Handle } from 'remix/ui'

export function ProductPage(handle: Handle<{ name: string; price: string }>) {
  return () => (
    <main>
      <h1>{handle.props.name}</h1>
      <p>{handle.props.price}</p>
    </main>
  )
}
```

Read current props from `handle.props`. Keep server data loading in the controller, then pass serializable values into the UI.

## Build your first form action {#build-your-first-form-action}

HTML forms are still the default mutation primitive. The route can accept a POST, validate `FormData`, write data, and redirect.

```tsx
import { redirect } from 'remix/response/redirect'

import { routes } from '../routes.ts'
import type { AppContext } from '../router.ts'

export async function createProject({ request }: AppContext) {
  let formData = await request.formData()
  let name = String(formData.get('name') ?? '').trim()

  if (name === '') {
    return new Response('Project name is required', { status: 400 })
  }

  return redirect(routes.projects.show.href({ projectId: name }), 303)
}
```

Start with the non-JavaScript behavior. Add client entries or frames only when they improve the experience on top of a working route.

## Add your first hydrated component {#add-your-first-hydrated-component}

Use `clientEntry` when a component needs browser state or events. The server still renders the initial HTML; the client entry adds behavior after boot.

```tsx
import { clientEntry, on, type Handle } from 'remix/ui'

export const Counter = clientEntry(
  import.meta.url,
  function Counter(handle: Handle<{ initialCount: number }>) {
    let count = handle.props.initialCount

    return () => (
      <button
        mix={on('click', () => {
          count++
          handle.update()
        })}
      >
        Count: {count}
      </button>
    )
  },
)
```

Frames and client entries compose. This example gets fresh server props when the frame reloads, while the local tap count stays in the hydrated component.

:::frame /docs/examples/start-here/lucky-number
:::
