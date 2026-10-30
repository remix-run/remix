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

Server frame resolvers receive `context.nonce` for nested renders. Client navigation preserves the original document nonce across streamed frames and island updates. Matching resource nonces are rewritten only when the initial document provides render-nonce metadata and the response's CSP identifies one shared nonce. The runtime uses `Content-Security-Policy-Report-Only` when `Content-Security-Policy` is absent, avoiding false nonce reports during navigation. The original document's policies remain active, and component props stay unchanged. See [CSP integration](https://github.com/remix-run/remix/tree/main/packages/component/src/server#content-security-policy) for resolver requirements.

Server CSS mixin styles must pass the document's CSP before adoption. Document navigation avoids premature style reports and keeps fetched scripts inert, including SVG scripts in streamed frames. Frame navigation discards `<noscript>` fallback content.
