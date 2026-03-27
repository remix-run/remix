---
name: remix-routing
description: Define and use the route contract of a Remix app. Use when authoring `app/routes.ts`, naming route keys, nesting route groups, choosing between `route()`, `form()`, `resource()`, and `resources()`, generating URLs with `href()`, or mapping controllers and actions to routes in `app/router.ts`.
---

# Remix Routing

Use this skill for the app's route contract: the typed `routes` tree in `app/routes.ts`, the URL
patterns it owns, and the controller or action shape that must match it.

This skill is about route design and mapping. Use `../remix-project-layout/SKILL.md` for where
route-owned files live on disk, `../remix-server/SKILL.md` for `createRouter(...)` and app-wide
middleware, and `../remix-ui/SKILL.md` for rendering and client-side navigation behavior.

## Procedure

1. Define one exported `routes` object in `app/routes.ts` using helpers from
   `remix/fetch-router/routes`.
2. Name route keys by feature ownership, then mirror meaningful nesting in both the route tree and
   the controller tree.
3. Pick the narrowest helper that matches the job:
   - plain strings or `get(...)`/`post(...)`/`put(...)`/`del(...)` for simple leaf routes
   - `form(...)` when one URL owns both the page and its submit action
   - `resource(...)` or `resources(...)` for singleton or collection CRUD-style routes
4. Generate links, redirects, and form actions from `routes...href()` instead of hardcoding URL
   strings.
5. Register routes in `app/router.ts` with `router.map(...)`: map simple leaves to `BuildAction`
   handlers and route subtrees to `Controller<typeof routes.section>` objects whose `actions` shape
   mirrors the route tree.
6. Add route-local middleware only where a route or controller subtree needs it. Keep app-wide
   middleware in `../remix-server/SKILL.md`.

## Typical Shape

```ts
// app/routes.ts
import { form, get, resources, route } from 'remix/fetch-router/routes'

export const routes = route({
  home: get('/'),
  contact: form('contact'),
  books: resources('books', { only: ['index', 'show'], param: 'bookId' }),
  account: route('account', {
    index: get('/'),
    settings: form('settings', {
      formMethod: 'PUT',
      names: { action: 'update' },
    }),
  }),
})
```

```ts
// app/router.ts
import { createRouter } from 'remix/fetch-router'

import accountController from './controllers/account/controller.tsx'
import booksController from './controllers/books/controller.tsx'
import contactController from './controllers/contact/controller.tsx'
import { home } from './controllers/home.tsx'
import { routes } from './routes.ts'

export const router = createRouter()

router.map(routes.home, home)
router.map(routes.contact, contactController)
router.map(routes.books, booksController)
router.map(routes.account, accountController)
```

## Load These References As Needed

- [./references/route-contracts-and-helpers.md](./references/route-contracts-and-helpers.md)
  Use for `route(...)`, method helpers, `form(...)`, `resource(...)`, `resources(...)`, and how to
  choose route names and nesting.
- [./references/hrefs-params-and-patterns.md](./references/hrefs-params-and-patterns.md)
  Use for `href()` generation, params, wildcards, optional segments, and when route-pattern syntax
  should influence the route contract.
- [./references/controller-mapping.md](./references/controller-mapping.md)
  Use for `router.map(...)`, `BuildAction`, `Controller<typeof routes...>`, subtree registration,
  and route-local middleware.

## Anti-Patterns

- Do not hardcode URLs in links, redirects, or form actions when a route already exists in
  `app/routes.ts`.
- Do not define routes ad hoc inside controllers or UI modules. Keep the route contract centralized.
- Do not let route nesting, controller ownership, and on-disk structure drift apart.
- Do not reach for full `resources(...)` CRUD when only a smaller surface is real. Use `only`,
  `exclude`, `param`, or `names` to keep the contract honest.
- Do not use this skill to decide root middleware order or `server.ts` wiring. That belongs in
  `../remix-server/SKILL.md`.
