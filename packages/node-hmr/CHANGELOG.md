# `node-hmr` CHANGELOG

This is the changelog for [`node-hmr`](https://github.com/remix-run/remix/tree/main/packages/node-hmr). It follows [semantic versioning](https://semver.org/).

## v1.0.1

### Patch Changes

- Fix cases where the dev server could stop responding to requests, miss file changes, or crash: ([#12198](https://github.com/remix-run/remix/pull/12198))
  - Requests waiting on `createHmrReadyFetch()` no longer hang forever when a restart is requested while a hot update is still being accepted, for example when an accept handler asks for a restart because a component module's client entries changed.
  - A file change made right after the server reports ready is no longer missed. `ready()` now also waits until newly watched directories are being watched.
  - Changes to the files a server module imports are no longer missed after that module is hot updated. Previously the runner stopped watching the module's unchanged imports once the update was accepted.
  - Changes to watched server files are no longer missed after the runner stops watching a directory that contains another watched directory.
  - A file watcher error is now logged instead of crashing the dev server.

- Changing files while the previous server process is still shutting down no longer starts an extra server process that keeps running in the background. The runner now spawns a single replacement once the previous process exits. ([#12199](https://github.com/remix-run/remix/pull/12199))

## v1.0.0

### Major Changes

- First stable release.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`terminal@1.0.0`](https://github.com/remix-run/remix/releases/tag/terminal@1.0.0)

## v0.2.1

### Patch Changes

- Declare which package modules have side effects.

- Bumped `@remix-run/*` dependencies:
  - [`terminal@0.1.2`](https://github.com/remix-run/remix/releases/tag/terminal@0.1.2)

## v0.2.0

### Minor Changes

- BREAKING CHANGE: Custom browser HMR update events now carry JSON data in a `data` record instead of top-level `timestamp` and `updates` fields (see #11706).

  Apps using the standard asset server and `createBrowserHmrChannel()` integration need no changes to their event handling. Give each tool a separate key in the record, for example `{ type: 'update', data: { 'my-tool@1': { version: 1 } } }`. `node-hmr` forwards this data unchanged to browser clients in a `{ type: 'browser:update', data }` event.

  ```diff
   channel.onFileEvents(async () => [
     {
       type: 'update',
  -    timestamp,
  -    updates,
  +    data: { 'my-tool@1': { timestamp, updates } },
     },
   ])
  ```

## v0.1.0

### Minor Changes

- Added the initial `@remix-run/node-hmr` package for supervising Node.js applications in development with an `import.meta.hot` API and optional parent-owned browser HMR coordination through `browserHmrChannel`.
