BREAKING CHANGE: Simplified route action helper types so `Action` and `BuildAction` no longer accept an unused request method type parameter. If you manually type route actions, pass only the route pattern or route object plus any request context type:

```ts
// before
let action = {
  handler(context) {
    return new Response(context.params.id)
  },
} satisfies BuildAction<'GET', typeof routes.account, AppContext>

// after
let action = {
  handler(context) {
    return new Response(context.params.id)
  },
} satisfies BuildAction<typeof routes.account, AppContext>
```

Renamed the custom router matcher payload type from `MatchData` to `RouteEntry`:

```ts
// before
let matcher = createMatcher<MatchData>()

// after
let matcher = createMatcher<RouteEntry>()
```
