BREAKING CHANGE: Custom browser HMR events from `remix/assets` and `remix/node-hmr` now carry update data in a `data` record. Replace top-level `timestamp` and `updates` fields with a named entry such as `data: { 'my-tool@1': { timestamp, updates } }`.

Apps using the standard asset server and `createBrowserHmrChannel()` integration need no changes to their event handling. See the [HMR migration example](https://github.com/remix-run/remix/blob/main/packages/node-hmr/CHANGELOG.md#v020) (see #11706).
