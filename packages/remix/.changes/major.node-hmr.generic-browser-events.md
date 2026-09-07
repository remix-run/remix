BREAKING CHANGE: Browser HMR channel update events from `remix/assets` and `remix/node-hmr` now carry consumer-owned JSON data under a generic `data` record instead of exposing JavaScript- and CSS-specific `timestamp` and `updates` fields.

Apps using the Remix app template's asset server and `createBrowserHmrChannel()` integration do not need to change. Custom browser HMR integrations must namespace each consumer's JSON-compatible data within the record, for example `{ type: 'update', data: { 'my-tool@1': { version: 1 } } }`.

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
