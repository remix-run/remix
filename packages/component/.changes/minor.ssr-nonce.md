Render under a nonce-based Content Security Policy with the `nonce` option on `renderToStream()` and `renderToString()`. Generated import maps, module preloads, and CSS mixin styles receive the nonce; explicitly authored `<ImportMap>` nonces are preserved.

```diff
+let nonce = crypto.getRandomValues(new Uint8Array(16)).toBase64()
+
 let stream = renderToStream(<App />, {
   frameSrc: request.url,
   signal: request.signal,
+  nonce,
 })
```

Client navigation preserves the document nonce across frame and island updates. See [CSP integration](https://github.com/remix-run/remix/tree/main/packages/component/src/server#content-security-policy) for nested rendering and custom resolver setup.
