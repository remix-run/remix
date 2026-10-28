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

Server frame resolvers receive `context.nonce` for nested renders. During client navigation and frame reloads, the original document nonce remains active. When a response's enforcing CSP identifies one shared nonce, matching resource nonces are rewritten before insertion, including streamed templates. Missing, ambiguous, and report-only nonces do not trigger rewriting. See [CSP integration](https://github.com/remix-run/remix/tree/main/packages/component/src/server#content-security-policy) for resolver requirements.
