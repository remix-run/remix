# Route Contracts And Helpers

Treat `app/routes.ts` as the single source of truth for URL ownership in the app.

Import route definition helpers from `remix/fetch-router/routes`, not from
`remix/fetch-router`. Keep runtime router setup in `app/router.ts`.

## Start With One Route Tree

Export one named `routes` object for the app, even if it contains multiple top-level sections:

```ts
import { form, get, post, route } from 'remix/fetch-router/routes'

export const routes = route({
  home: get('/'),
  auth: route('auth', {
    login: form('login'),
    logout: post('logout'),
  }),
  account: route('account', {
    index: get('/'),
    settings: form('settings'),
  }),
})
```

This route tree is the contract that UI, redirects, and controllers all depend on.

## Pick The Right Helper

Use a plain string when the route really is method-agnostic. Use method helpers when the route
should be explicit about `GET`, `POST`, `PUT`, or `DELETE`.

Use `form(path)` when one URL has both:

- a `GET` page route at `.index`
- a form submission route at `.action`

Use `resource(path)` for a singleton resource such as a profile or settings document.

Use `resources(path)` for a collection or CRUD surface such as books, users, or orders.

Keep the generated surface honest:

- use `only` when you only need a subset of actions
- use `exclude` when most defaults fit and a few do not
- use `param` when `:id` is too generic for the surrounding feature
- use `names` when a different route name makes the call site clearer

## Nest By Ownership

Nest routes when the URL space and controller ownership belong together.

Good fits:

- auth callbacks grouped under `routes.auth`
- account pages grouped under `routes.account`
- admin resource surfaces grouped under `routes.admin`

Do not nest only because the URL happens to share a prefix. The nesting should also improve how
controllers are registered and reasoned about.

## Keep The Contract Close To Real Usage

Prefer route names that make call sites read well:

- `routes.books.index.href()`
- `routes.books.show.href({ bookId })`
- `routes.auth.login.index.href()`
- `routes.auth.login.action.href()`

If the route name or helper choice makes those call sites awkward, improve the route contract
instead of teaching the app to work around it.
