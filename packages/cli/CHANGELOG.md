# `cli` CHANGELOG

This is the changelog for [`cli`](https://github.com/remix-run/remix/tree/main/packages/cli). It follows [semantic versioning](https://semver.org/).

## v0.6.0

### Minor Changes

- Add `remix db rollback`, which reverts applied migrations by running their `down.sql`

  `Database.migrate()` already accepted `direction`, `to`, `step`, and `dryRun`, but the CLI never passed them, so a migration's `down.sql` was unreachable from `remix db` — `--to` only bounds forward progress. `rollback` reverts newest first, bounded by `--step <count>` (default `1`) or `--to <migration>`, which reverts back through that migration inclusive. `--dry-run` reports what would be reverted without running it. It also takes `--migrations`, `--journal-table`, and `--connection-env` (see #11723).

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.5.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.5.0)
  - [`data-table-mysql@0.5.1`](https://github.com/remix-run/remix/releases/tag/data-table-mysql@0.5.1)
  - [`data-table-postgres@0.5.1`](https://github.com/remix-run/remix/releases/tag/data-table-postgres@0.5.1)
  - [`data-table-sqlite@0.6.1`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.6.1)

## v0.5.0

### Minor Changes

- Updated the default `remix new` app template to provide preloads for client entries

## v0.4.0

### Minor Changes

- BREAKING CHANGE: Added an optional static `remix.json` configuration file for Remix CLI commands, covering database adapters, migrations, and seeds; every `remix test` setting; and strict mode for `remix doctor`. The CLI parses the file as JSONC, resolves its relative paths and globs from the config file's directory, and lets explicit flags and positional arguments take precedence. Use the global `--config <path>` option to select another file. Negative flags such as `remix doctor --no-strict`, `--no-watch`, `--no-coverage`, `--no-quiet`, `--no-browser.open`, and `--no-browser.echo` can override configured `true` values. The former test-specific meaning of `--config` and automatic `remix-test.config.ts` or `.js` discovery have been removed; move those values under `remix.json#test` (see #11628, #11638, #11639).

- Added `remix db` commands for wiping, migrating, inspecting, seeding, and resetting the current app database. Static `remix.json` configuration selects a built-in SQLite, PostgreSQL, or MySQL adapter, names environment-backed connection values, and configures migrations, the journal table, and an optional SQL seed file. Database commands find the nearest config from a project subdirectory, while global `--config` and command flags remain authoritative. Destructive commands (`remix db wipe` and `remix db reset`) require `--force` (see #11608, #11639).

- New projects now include an `npm run hmr` command and `hmr.ts` runner

- Added complete `remix test` argument parsing, help, validation, and shell completion to the main Remix CLI. The command delegates typed runner options to `@remix-run/test/cli` while preserving positional globs, repeated flags, aliases, configuration precedence, coverage, filtering, and watch behavior (see #11623).

### Patch Changes

- Limit `remix doctor` action checks to the directory and controller paths required by `app/routes.ts`. Unrelated files and directories under `app/actions` are ignored, and `remix doctor --fix` no longer generates action controllers.

- Scaffold browser-reachable source in colocated `public/` directories throughout `app/`, with the browser runtime entry at `app/actions/public/entry.ts`, while keeping the shared `app/routes.ts` contract browser-readable.

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.4.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.4.0)
  - [`data-table-mysql@0.5.0`](https://github.com/remix-run/remix/releases/tag/data-table-mysql@0.5.0)
  - [`data-table-postgres@0.5.0`](https://github.com/remix-run/remix/releases/tag/data-table-postgres@0.5.0)
  - [`data-table-sqlite@0.6.0`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.6.0)
  - [`test@0.6.0`](https://github.com/remix-run/remix/releases/tag/test@0.6.0)

## v0.3.4

### Patch Changes

- Improve the default `remix new` app template so production starts with `NODE_ENV=production`, minifies browser assets, resolves frames on the client and server, and uses the dev server watcher instead of the asset server watcher.

- Prevent `remix doctor --fix` from creating or updating files outside the project root when fix paths traverse symlinks (see #11532).

## v0.3.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`test@0.5.0`](https://github.com/remix-run/remix/releases/tag/test@0.5.0)

## v0.3.2

### Patch Changes

- Remove Remix-repo specific logic from template.

- Bumped `@remix-run/*` dependencies:
  - [`test@0.4.2`](https://github.com/remix-run/remix/releases/tag/test@0.4.2)

## v0.3.1

### Patch Changes

- Fix help text syntax highlighting so hyphens in path arguments like `./my-remix-app` are not highlighted as single-character flags (see #11409).

- Bumped `@remix-run/*` dependencies:
  - [`terminal@0.1.1`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.1)
  - [`test@0.4.1`](https://github.com/remix-run/remix/releases/tag/test@0.4.1)

## v0.3.0

### Minor Changes

- BREAKING CHANGE: Remix app scaffolding, `remix doctor`, and `remix routes` now use `app/actions` with controller files only. The old `app/controllers` directory name has been replaced by `app/actions`, and root route actions should no longer live in standalone files.

  When upgrading an app, move `app/controllers` to `app/actions`, then consolidate root leaf route files into `app/actions/controller.tsx`. For example, old files like `app/controllers/home.tsx`, `app/controllers/about.tsx`, or `app/controllers/uploads.ts` should become `home`, `about`, and `uploads` entries in the root controller's `actions` object. Root controller tests should follow the same shape and live in `app/actions/controller.test.ts` or `app/actions/controller.test.tsx`.

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

  The default template now starts with a single home route. Shared HTML rendering should live in middleware and be read from request context with `context.render`, matching the default template's `app/middleware/render.tsx` pattern.

- Updated the default `remix new` app template to serve static assets from `public/`, include a Remix favicon, and share the generated document shell between the starter home page and future routes.

### Patch Changes

- Fixed CLI argument edge cases so `--` separators still work after global options, completion help can be requested after a shell name, and `remix test` completions no longer duplicate `--help`.

- Changed the default `remix new` server template to use `remix/node-fetch-server` instead of `remix/node-serve`, avoiding the native uWebSockets.js transport for freshly scaffolded apps.

- Fixed `remix new` so scaffolded apps include the template `.gitignore` file from the published CLI package.

- Simplified the default app template asset server configuration so workspace installs serve package imports through `node_modules` without Remix monorepo-specific `../packages` rules.

- Simplified the default `remix new` home page so it relies on the shared document title default instead of duplicating app display-name decoding in the scaffold page module.

- Removed unused frame resolver plumbing from the default `remix new` app template while keeping the client-entry setup used for isolated browser interactivity.

- Updated the default app template's Remix agent skill so code agents can discover the available `remix/*` README files shipped in `node_modules/remix`.

- Improved the packaging flow for the `remix new` app template so the template can run directly as a root workspace during development while still being included in the published CLI package.

- Bumped `@remix-run/*` dependencies:
  - [`test@0.4.0`](https://github.com/remix-run/remix/releases/tag/test@0.4.0)

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
