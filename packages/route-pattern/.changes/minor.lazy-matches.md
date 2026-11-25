Added a `lazyMatches` option to `createMatcher()` and `createMultiMatcher()` for routers and other code that only reads a match's `params` or `data`. Lazy matches compute `url` and `paramsMeta` the first time they are read, and URL strings that are already in the form `URL` serializes to, such as `request.url`, are matched without being parsed into a `URL`. In our benchmarks, matching `request.url` against a route with a param is about 40% faster with lazy matches.

```ts
let matcher = createMultiMatcher<Route>({ lazyMatches: true })
let match = matcher.match(request.url)
match?.params
```

Lazy matches are class instances whose `url` and `paramsMeta` are getters, so spreading a lazy match or passing it to `JSON.stringify()` leaves them out. Matchers created without the option return the same plain objects as before.
