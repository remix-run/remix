# `session-middleware` CHANGELOG

This is the changelog for [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware). It follows [semantic versioning](https://semver.org/).

## v0.2.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.2`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.2)

## v0.2.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.1)

## v0.2.0

### Minor Changes

- BREAKING CHANGE: Session middleware no longer reads/writes `context.session`.

  Session state is now stored on request context using the `Session` class itself as the context key and accessed with `context.get(Session)`.

- `session()` now contributes `Session` to `fetch-router`'s typed request context, so apps deriving context from middleware can read `context.get(Session)` without manual type assertions.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.0)

## v0.1.4

### Patch Changes

- Ensure response is mutable before modifying.

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.17.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.17.0)

## v0.1.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`@remix-run/fetch-router@0.16.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.16.0)

## v0.1.2

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v0.1.1 (2025-12-06)

- Use `response.headers.append('Set-Cookie', ...)` instead of `response.headers.set('Set-Cookie', ...)` to not overwrite cookies set by other middleware/handlers

## v0.1.0 (2025-11-19)

Initial release extracted from `@remix-run/fetch-router` v0.9.0.

See the [README](https://github.com/remix-run/remix/blob/main/packages/session-middleware/README.md) for more details.
