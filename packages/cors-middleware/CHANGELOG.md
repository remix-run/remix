# `cors-middleware` CHANGELOG

This is the changelog for [`cors-middleware`](https://github.com/remix-run/remix/tree/main/packages/cors-middleware). It follows [semantic versioning](https://semver.org/).

## v0.1.0

### Minor Changes

- Add the initial release of `@remix-run/cors-middleware`.

  - Expose `cors(options)` for standard CORS response headers and preflight handling in Fetch API servers.
  - Support static and dynamic origin policies, credentialed requests, allowed and exposed headers, preflight max-age, and private network preflights.
  - Allow apps to either short-circuit preflight requests or continue them into custom `OPTIONS` handlers.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.0)

## v0.0.0

### Minor Changes

- Initial release.
