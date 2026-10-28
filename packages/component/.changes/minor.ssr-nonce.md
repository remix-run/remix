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

Server frame resolvers receive `context.nonce` for nested renders. During client navigation and frame reloads, the original document nonce remains active. When a response's enforcing CSP identifies one shared nonce, matching resource nonces are rewritten before insertion, including streamed templates. The destination nonce comes from the initial document's render-nonce metadata; an authored import-map nonce alone does not enable resource rewriting. Hydrated islands keep matching resource nonces aligned with the document during later renders and element replacement, including islands preserved across responses with different nonces. Serialized props and unrelated attributes retain their original values. Missing, ambiguous, and report-only nonces do not trigger rewriting. See [CSP integration](https://github.com/remix-run/remix/tree/main/packages/component/src/server#content-security-policy) for resolver requirements.

Server-rendered CSS mixin styles are adopted only after the browser accepts them under the active document's policy. Styles blocked by CSP remain blocked during hydration, navigation, and streamed frame updates.

Document navigation avoids premature CSP style reports while preserving document attributes, head updates, and inert scripts, including SVG scripts in streamed frames. Frame navigation discards `<noscript>` fallback content.
