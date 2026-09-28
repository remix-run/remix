# `csrf-middleware` CHANGELOG

This is the changelog for [`csrf-middleware`](https://github.com/remix-run/remix/tree/main/packages/csrf-middleware). It follows [semantic versioning](https://semver.org/).

## v0.2.0

### Minor Changes

- BREAKING CHANGE: `csrf()` now reads submitted tokens from headers and parsed form fields only by default. Requests that supply a token only in the query string are rejected. Applications that need query parameter tokens can retain that behavior with an explicit `value` resolver, which replaces the default lookup:

  ```diff
  -csrf()
  +csrf({
  +  value(context) {
  +    return context.url.searchParams.get('_csrf')
  +  },
  +})
  ```

### Patch Changes

- Declare package modules as side-effect-free.

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.22.2`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.22.2)
  - [`session@0.4.3`](https://github.com/remix-run/remix/releases/tag/session@0.4.3)

## v0.1.10

### Patch Changes

- Use the original request method when deciding whether validation is required, so routing method overrides do not change request classification.

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.22.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.22.1)

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

## v0.1.4

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.1)
  - [`session@0.4.2`](https://github.com/remix-run/remix/releases/tag/session@0.4.2)

## v0.1.3

### Patch Changes

- Fixed CSRF helper and callback types so they accept request contexts enriched by middleware such as `session()` and `formData()`.

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.0)

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

- Add the initial release of `@remix-run/csrf-middleware`.
  - Expose `csrf(options)` and `getCsrfToken(context)` for session-backed CSRF protection in Remix apps that accept unsafe form submissions.
  - Validate a per-session token together with request origin metadata, with support for token transport in headers, form data, and query params.
  - Allow apps to layer `csrf()` after `cop()` when they need stricter token-backed protection on top of browser-origin filtering.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.0)

## v0.0.0

### Minor Changes

- Initial release.
