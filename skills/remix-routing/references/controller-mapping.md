# Controller Mapping

Keep the route contract in `app/routes.ts` and the registration in `app/router.ts`.

The router should read like a map from route ownership to controller ownership:

```ts
router.map(routes.home, home)
router.map(routes.contact, contactController)
router.map(routes.books, booksController)
router.map(routes.account, accountController)
```

## Leaf Routes

Use a `BuildAction` for a simple leaf route when one handler owns that route:

```ts
import type { BuildAction } from 'remix/fetch-router'

import { routes } from '../routes.ts'

export const home: BuildAction<'GET', typeof routes.home> = {
  async handler(context) {
    return new Response('home')
  },
}
```

This is a good fit for standalone pages, simple uploads, or one-off endpoints.

## Route Subtrees

Use `Controller<typeof routes.section>` when a feature owns multiple related routes:

```ts
import type { Controller } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'

export default {
  actions: {
    index() {
      return new Response('account')
    },
    settings: {
      actions: {
        index() {
          return new Response('settings form')
        },
        update() {
          return new Response('updated')
        },
      },
    },
  },
} satisfies Controller<typeof routes.account>
```

The `actions` shape should mirror the route subtree. If it does not, the route contract and the
controller design are probably fighting each other.

## `router.map(...)` Vs Method Helpers

Use `router.map(...)` as the default because it keeps the route contract and the handler tree aligned.

Use `router.get(...)`, `router.post(...)`, and similar helpers when:

- you are wiring a single leaf route
- the route contract is already declared elsewhere
- the direct method registration is clearer than introducing a controller object

## Route-Local Middleware

Attach route-local middleware where the route contract needs it:

- a protected account subtree
- admin-only routes
- validation unique to one resource action

Keep app-wide middleware such as logging, static files, session loading, and auth resolution in
`../remix-server/SKILL.md`.
