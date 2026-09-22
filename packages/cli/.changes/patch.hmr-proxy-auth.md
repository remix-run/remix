Generated apps now trust forwarded headers while running under `node-hmr`, so `cop()` and `csrf()` compare form origins against the browser-facing URL.

Existing generated apps can apply the same setup in `server.ts`:

```diff
+let isHmr = process.env.REMIX_NODE_HMR === '1'
 let server = http.createServer(
-  createRequestListener(handler),
+  createRequestListener(handler, { trustProxy: isHmr }),
 )
```
