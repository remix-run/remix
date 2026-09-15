# `spa` CHANGELOG

This is the changelog for [`spa`](https://github.com/remix-run/remix/tree/main/packages/spa). It follows [semantic versioning](https://semver.org/).

## v0.1.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`render-middleware@0.3.1`](https://github.com/remix-run/remix/releases/tag/render-middleware@0.3.1)
  - [`ui@0.10.0`](https://github.com/remix-run/remix/releases/tag/ui@0.10.0)

## v0.1.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.22.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.22.0)
  - [`render-middleware@0.3.0`](https://github.com/remix-run/remix/releases/tag/render-middleware@0.3.0)
  - [`ui@0.9.0`](https://github.com/remix-run/remix/releases/tag/ui@0.9.0)

## v0.1.0

### Minor Changes

- Added the initial `@remix-run/spa` package with `render()` middleware and a `run(router, { fallback? })` browser runtime for client-rendered Remix applications. Route handlers use `context.render()` while the package preserves the router's `Request` to `Response` contract and hides the SPA response carrier.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`render-middleware@0.2.0`](https://github.com/remix-run/remix/releases/tag/render-middleware@0.2.0)
  - [`ui@0.8.0`](https://github.com/remix-run/remix/releases/tag/ui@0.8.0)

## Unreleased
