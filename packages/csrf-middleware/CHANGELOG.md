# `csrf-middleware` CHANGELOG

This is the changelog for [`csrf-middleware`](https://github.com/remix-run/remix/tree/main/packages/csrf-middleware). It follows [semantic versioning](https://semver.org/).

## v0.1.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## v0.1.0

### Minor Changes

- Add the initial release of `@remix-run/csrf-middleware`.

  - Expose `csrf(options)` and `getCsrfToken(context)` for session-backed CSRF protection in
    Remix apps that accept unsafe form submissions.
  - Validate a per-session token together with request origin metadata, with support for token
    transport in headers, form data, and query params.
  - Allow apps to layer `csrf()` after `cop()` when they need stricter token-backed protection
    on top of browser-origin filtering.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.0)

## v0.0.0

### Minor Changes

- Initial release.
