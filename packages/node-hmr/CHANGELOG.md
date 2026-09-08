# `node-hmr` CHANGELOG

This is the changelog for [`node-hmr`](https://github.com/remix-run/remix/tree/main/packages/node-hmr). It follows [semantic versioning](https://semver.org/).

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
