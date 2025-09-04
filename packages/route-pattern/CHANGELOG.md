# `route-pattern` CHANGELOG

This is the changelog for [`route-pattern`](https://github.com/remix-run/remix/tree/v3/packages/route-pattern). It follows [semantic versioning](https://semver.org/).

## v0.10.0 (2025-09-04)

- BREAKING CHANGE: removed `match.protocol`, `match.hostname`, `match.port`, `match.pathname`, `match.search`, and `match.searchParams`. Use `match.url` instead
- Fix search matching and add more fine-grained examples

## v0.9.1 (2025-09-04)

- Fix handling of patterns with leading slash
- Make variables not greedy

```tsx
let pattern = new RoutePattern('/:id(.json)')
// Before :id was greedy and would consume ".json"
pattern.match('https://remix.run/123.json')
// { params: { id: '123.json' } }
// After
pattern.match('https://remix.run/123.json')
// { params: { id: '123' } }
```

- Allow search params values to have type `string | number | bigint | boolean` and automatically stringify

## v0.9.0 (2025-09-03)

- Add `protocol`, `hostname`, `port`, `pathname`, `search`, and `searchParams` properties to the `Match` interface. This is useful to avoid parsing the URL twice when passing a string directly to `pattern.match(urlString)`
- Fix `protocol` and `hostname` to always ignore case given in the pattern
- Add `ignoreCase` option to `RoutePattern` constructor to match URL pathnames in a case-insensitive way

```tsx
let pattern = new RoutePattern('https://remix.run/users/:id', { ignoreCase: true })
pattern.match('https://remix.run/Users/123') // { ..., params: { id: '123' } }
```

## v0.8.0 (2025-09-03)

- Any valid pattern is also valid in `href(pattern)`
- Href generation with missing optional variables omits the optional section entirely

```tsx
let href = createHrefBuilder()
href('products(/:id)', { id: 'remix' }) // /products/remix

// These all used to fail, but are now OK!
href('products(/:id)') // /products
href('products(/:id)', {}) // /products
href('products(/:id)', { id: null }) // /products (type error)
href('products(/:id)', { id: undefined }) // /products (type error)
```

- Param values may be `string | number | bigint | boolean` and are automatically stringified

```tsx
let href = createHrefBuilder()

// These used to be a type errors, but are now OK!
href('products(/:id)', { id: 1 }) // /products/1
href('products(/:id)', { id: false }) // /products/false
```

## v0.7.0 (2025-09-01)

- Add support for nested optionals in route patterns

```tsx
// Now you can do stuff like
let pattern = new RoutePattern('api(/v:major(.:minor))')
pattern.match('https://remix.run/api') // { params: {} }
pattern.match('https://remix.run/api/v1') // { params: { major: '1' } }
pattern.match('https://remix.run/api/v1.2') // { params: { major: '1', minor : '2' } }
```

- Make `pattern.match().params` type-safe
- Export top-level `Params<pattern>` helper for extracting params from a pattern
- Tighten up some types in `href()`. Now you get variants for
  - all the different values of an enum
  - unnamed wildcards
- Fix bug when using unnamed wildcards in `href()`

## v0.6.0 (2025-08-29)

- Use a single RegExp to match protocol, hostname, port, and pathname
- Allow duplicate variable names in patterns, right-most shows up in `match.params`
- Allow route patterns to match on port
- All variables require names, wildcards may have a name or be "unnamed"

## v0.4.0 (2025-07-24)

- Renamed package from `@mjackson/route-pattern` to `@remix-run/route-pattern`
