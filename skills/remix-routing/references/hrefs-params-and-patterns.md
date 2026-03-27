# Hrefs, Params, And Patterns

Use `routes...href()` everywhere the app needs a URL:

- links
- redirects
- form actions
- asset or fragment URLs

That keeps navigation, redirects, and handler registration aligned with one route contract.

## Path Params

Dynamic segments become typed params:

```ts
routes.books.show.href({ slug: 'the-left-hand-of-darkness' })
routes.account.orders.show.href({ orderId: '42' })
routes.auth.resetPassword.index.href({ token: 'abc123' })
```

If a resource route would otherwise generate a vague `:id`, use `param` so call sites stay clear:

```ts
resources('users', {
  only: ['show', 'edit', 'update'],
  param: 'userId',
})
```

## Search Params

Pass search params as the second `href()` argument when the redirect or link needs query state:

```ts
routes.auth.login.index.href(undefined, {
  returnTo: '/account/orders/42',
})
```

Use this for values such as `returnTo`, filters, or tab state when the route contract should own the
base pathname but the current navigation needs extra query state.

## Pattern Syntax

Route patterns use `route-pattern` syntax:

- `:name` for one dynamic segment
- `*name` for a wildcard path
- `(...)` for optional segments

Examples:

- `'/books/:slug'`
- `'/assets/*path'`
- `'/reset-password/:token'`
- `'api(/v:version)/users'`

Prefer the simplest pattern that matches real app behavior. Reach for wildcards and optionals only
when the URL space truly needs them.

## Match The Pattern To The Owner

If a wildcard or optional route starts making the surrounding controller hard to understand, the
problem is usually the route contract, not the controller implementation.

Prefer several explicit routes over one overly clever pattern when:

- different pages need different UI
- different actions need different middleware
- the params shape stops being obvious from the route name
