---
name: new-route
description: Add a new route to a Remix app by defining it in app/routes.ts, implementing the handler, wiring it in app/router.ts, and using route href helpers for links and forms.
---

# Create a New Route

Use this skill when adding a page or endpoint to a Remix app built with `remix/fetch-router`.

## Workflow

1. Define the route in `app/routes.ts`.

- Keep route names descriptive and group related routes under nested objects.
- Use method helpers when a route should match only one method (`get`, `post`, `put`, `del`, `form`).

```ts
import { get, route } from 'remix/fetch-router/routes'

export let routes = route({
  home: '/',
  dashboard: get('/dashboard'),
})
```

2. Implement the route handler.

- For a single action, export a typed `BuildAction`.
- For multi-action routes (such as form GET + POST), export a `Controller` with `actions`.

```ts
import type { BuildAction } from 'remix/fetch-router'

import { routes } from './routes.ts'

export let dashboard: BuildAction<'GET', typeof routes.dashboard> = {
  async action() {
    return new Response('Dashboard')
  },
}
```

3. Map the route in `app/router.ts`.

- Import the handler and register it with `router.map(...)`.

```ts
import { routes } from './routes.ts'
import { dashboard } from './dashboard.tsx'

router.map(routes.dashboard, dashboard)
```

4. Link to the new route with `href()`.

- Use route helpers instead of hard-coded path strings.

```tsx
<a href={routes.dashboard.href()}>Dashboard</a>
```

5. Add a focused test.

- Add or update `app/router.test.ts` (or a route-specific `*.test.ts`) to verify method + path + response behavior.

## Example: GET + POST Form Route

```ts
import { form, route } from 'remix/fetch-router/routes'

export let routes = route({
  contact: form('contact'),
})
```

```ts
import type { Controller } from 'remix/fetch-router'

import { routes } from './routes.ts'

export let contactController: Controller<typeof routes.contact> = {
  actions: {
    index() {
      return new Response('<form method="post"></form>', {
        headers: { 'Content-Type': 'text/html' },
      })
    },
    async action({ formData }) {
      let message = String(formData.get('message') ?? '')
      return new Response(`Thanks: ${message}`)
    },
  },
}
```

## Checklist

- [ ] Route added in `app/routes.ts`
- [ ] Handler/controller implemented and typed
- [ ] Route registered in `app/router.ts`
- [ ] Navigation/form actions use `routes.<name>.href()`
- [ ] Test coverage added for the new behavior
