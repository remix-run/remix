# `route-pattern` CHANGELOG

This is the changelog for [`route-pattern`](https://github.com/remix-run/remix/tree/v3/packages/route-pattern). It follows [semantic versioning](https://semver.org/).

## HEAD

- Tighten up some types in `href()`. Now you get variants for
  - all the different values of an enum
  - unnamed wildcards

## v0.6.0 (2025-08-29)

- Use a single RegExp to match protocol, hostname, port, and pathname
- Allow duplicate variable names in patterns, right-most shows up in `match.params`
- Allow route patterns to match on port
- All variables require names, wildcards may have a name or be "unnamed"

## v0.4.0 (2025-07-24)

- Renamed package from `@mjackson/route-pattern` to `@remix-run/route-pattern`
