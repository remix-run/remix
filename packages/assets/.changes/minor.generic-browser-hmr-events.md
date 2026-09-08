BREAKING CHANGE: Browser HMR channel update events now carry consumer-owned JSON data under a generic `data` record instead of exposing JavaScript- and CSS-specific `timestamp` and `updates` fields.

Apps using the Remix app template's asset server and `createBrowserHmrChannel()` integration do not need to change. Custom browser HMR channels must namespace each consumer's JSON-compatible data within the record, for example `{ type: 'update', data: { 'my-tool@1': { version: 1 } } }`.

```diff
 type BrowserHmrEvent = {
   type: 'update'
-  timestamp: number
-  updates: HmrBrowserUpdate[]
+  data: Record<string, BrowserHmrData>
 }
```
