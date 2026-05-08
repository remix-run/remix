# `cli` CHANGELOG

This is the changelog for [`cli`](https://github.com/remix-run/remix/tree/main/packages/cli). It follows [semantic versioning](https://semver.org/).

## v0.3.0

### Minor Changes

- BREAKING CHANGE: Remix app scaffolding, `remix doctor`, and `remix routes` now use `app/actions` with controller files only. The old `app/controllers` directory name has been replaced by `app/actions`, and root route actions should no longer live in standalone files.

  Agents upgrading an app should move `app/controllers` to `app/actions`, then consolidate root leaf route files into `app/actions/controller.tsx`. For example, old files like `app/controllers/home.tsx`, `app/controllers/about.tsx`, or `app/controllers/uploads.ts` should become `home`, `about`, and `uploads` entries in the root controller's `actions` object. Root controller tests should follow the same shape and live in `app/actions/controller.test.ts` or `app/actions/controller.test.tsx`.

  Nested route maps should live under directories named for route-map keys, not URL path segments. For example, `routes.auth` is owned by `app/actions/auth/controller.tsx`, and `routes.account.settings` is owned by `app/actions/account/settings/controller.tsx`. Keep route-local pages, schemas, helpers, and tests beside the controller that owns them, but move shared cross-route UI to `app/ui`.

  This migration also changes how apps should call `router.map()`. A controller owns the direct leaf routes in the route map passed to `router.map()`: `router.map(routes, rootController)` maps only direct leaf routes in the root route map, so nested route-map keys such as `auth`, `account`, or `admin` do not belong in the root controller's `actions` object. Map every nested route map explicitly in `app/router.ts`:

  ```ts
  router.map(routes, rootController)
  router.map(routes.auth, authController)
  router.map(routes.account, accountController)
  router.map(routes.account.settings, accountSettingsController)
  ```

  Controller middleware applies only to the direct actions in that controller. Middleware on `app/actions/controller.tsx` applies only to the direct root actions in that controller; it does not protect controllers registered for nested route maps. If an app previously relied on middleware from one controller to protect another controller, copy the relevant middleware to each controller that needs it, such as `app/actions/account/controller.tsx` and `app/actions/account/settings/controller.tsx`.

  After moving files, remove nested route-map keys and unknown action keys from every controller. Each controller's `actions` object should contain exactly the direct leaf route keys for the route map passed to the matching `router.map()` call.

  Shared HTML response helpers that are only used by controllers should also live under `app/actions`, such as `app/actions/render.tsx`, instead of `app/utils`.

### Patch Changes

- Fixed CLI argument edge cases so `--` separators still work after global options, completion help can be requested after a shell name, and `remix test` completions no longer duplicate `--help`.

- Changed the default `remix new` server template to use `remix/node-fetch-server` instead of `remix/node-serve`, avoiding the native uWebSockets.js transport for freshly scaffolded apps.

- Improved the packaging flow for the `remix new` app template so the template can run directly as a root workspace during development while still being included in the published CLI package.

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
