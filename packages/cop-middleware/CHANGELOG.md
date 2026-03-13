# `cop-middleware` CHANGELOG

This is the changelog for [`cop-middleware`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware). It follows [semantic versioning](https://semver.org/).

## v0.1.0

### Minor Changes

- Add the initial release of `@remix-run/cop-middleware`.

  - Expose `cop(options)` for browser-focused cross-origin protection using `Sec-Fetch-Site`
    with `Origin` fallback.
  - Support trusted origins, explicit insecure bypass patterns, and custom deny handlers.
  - Allow apps to layer `cop()` ahead of `session()` and `csrf()` when they want both
    browser-origin filtering and token-backed CSRF protection.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.0)

## v0.0.0

### Minor Changes

- Initial release.
