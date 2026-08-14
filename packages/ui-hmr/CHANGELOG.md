# `ui-hmr` CHANGELOG

This is the changelog for [`ui-hmr`](https://github.com/remix-run/remix/tree/main/packages/ui-hmr). It follows [semantic versioning](https://semver.org/).

## v0.1.0

### Minor Changes

- Added the initial `@remix-run/ui-hmr` package with Remix UI component HMR runtimes, a `remix/assets` loader, and Node module hooks.

  Use `remix/ui-hmr/node` as a Node import hook for server modules and `uiHmr()` from `remix/ui-hmr/assets` with `remix/assets` for browser modules.
