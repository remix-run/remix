# `cors-middleware` CHANGELOG

This is the changelog for [`cors-middleware`](https://github.com/remix-run/remix/tree/main/packages/cors-middleware). It follows [semantic versioning](https://semver.org/).

## v0.2.0

### Minor Changes

- BREAKING CHANGE: `cors({ credentials: true })` now preserves the default `Access-Control-Allow-Origin: *` response. Applications that intentionally allow credentialed requests from any origin must configure `origin: '*'` explicitly; applications with a restricted origin policy should continue to configure an exact origin, pattern, array, or resolver.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`headers@0.21.2`](https://github.com/remix-run/remix/releases/tag/headers@0.21.2)

## v0.1.9

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.22.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.22.0)

## v0.1.8

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.21.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.21.0)

## v0.1.7

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.20.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.20.1)

## v0.1.6

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.20.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.20.0)

## v0.1.5

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.2`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.2)
  - [`headers@0.21.1`](https://github.com/remix-run/remix/releases/tag/headers@0.21.1)

## v0.1.4

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.1)
  - [`headers@0.21.0`](https://github.com/remix-run/remix/releases/tag/headers@0.21.0)

## v0.1.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.0)
  - [`headers@0.20.0`](https://github.com/remix-run/remix/releases/tag/headers@0.20.0)

## v0.1.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.2`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.2)

## v0.1.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

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
