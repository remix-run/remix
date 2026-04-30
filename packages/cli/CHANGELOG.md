# `cli` CHANGELOG

This is the changelog for [`cli`](https://github.com/remix-run/remix/tree/main/packages/cli). It follows [semantic versioning](https://semver.org/).

## v0.2.0

### Minor Changes

- BREAKING CHANGE: Remove the `remix skills` command from the Remix CLI.

- Use `remix/node-serve` as the default server in new apps created with `remix new`.

### Patch Changes

- Lazy-load command implementations after CLI command dispatch so unrelated commands do not load optional command dependencies during startup.

- Bumped `@remix-run/*` dependencies:
  - [`test@0.3.0`](https://github.com/remix-run/remix/releases/tag/test@0.3.0)

## v0.1.0

### Minor Changes

- Initial release of `@remix-run/cli` with the public `runRemix()` API and commands for project scaffolding, health checks and fixes, route inspection, and running tests. The package requires Node.js 24.3.0 or later and exposes the programmatic CLI API; use the `remix` package for the user-facing `remix` executable.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`terminal@0.1.0`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.0)
  - [`test@0.2.0`](https://github.com/remix-run/remix/releases/tag/test@0.2.0)

## Unreleased
