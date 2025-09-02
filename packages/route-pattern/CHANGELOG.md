# `route-pattern` CHANGELOG

This is the changelog for [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern). It follows [semantic versioning](https://semver.org/).

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
