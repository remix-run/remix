# `session-middleware` CHANGELOG

This is the changelog for [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware). It follows [semantic versioning](https://semver.org/).

## Unreleased

- Use `response.headers.append('Set-Cookie', ...)` instead of `response.headers.set('Set-Cookie', ...)` to not overwrite cookies set by other middleware/handlers

## v0.1.0 (2025-11-19)

Initial release extracted from `@remix-run/fetch-router` v0.9.0.

See the [README](https://github.com/remix-run/remix/blob/main/packages/session-middleware/README.md) for more details.
