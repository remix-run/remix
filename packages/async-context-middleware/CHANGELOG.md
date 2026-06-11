# `async-context-middleware` CHANGELOG

This is the changelog for [`async-context-middleware`](https://github.com/remix-run/remix/tree/main/packages/async-context-middleware). It follows [semantic versioning](https://semver.org/).

## v0.3.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.20.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.20.0)

## v0.3.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.2`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.2)

## v0.3.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.1)

## v0.3.0

### Minor Changes

- BREAKING CHANGE: `getContext()` now derives its type from `fetch-router`'s `RouterTypes.context`, with route params broadened to `AnyParams`. The separate `AsyncContextTypes.requestContext` augmentation has been removed, so apps that configure their router context no longer need a second async-context-specific augmentation.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.0)

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

- `getContext()` can now be typed per app by augmenting `AsyncContextTypes`, which makes `asyncContext()` work cleanly with app-specific `fetch-router` request context contracts.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.18.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.0)

## v0.1.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.17.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.17.0)

## v0.1.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`@remix-run/fetch-router@0.16.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.16.0)

## v0.1.1

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v0.1.0 (2025-11-19)

Initial release extracted from `@remix-run/fetch-router` v0.9.0.

See the [README](https://github.com/remix-run/remix/blob/main/packages/async-context-middleware/README.md) for more details.
