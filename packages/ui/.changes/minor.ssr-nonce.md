`renderToStream()` now accepts a `nonce` and stamps it on the elements it generates itself: the import map script and the `<style>` tags the `css` mixin emits. Under a `Content-Security-Policy` that names a nonce, those elements were previously blocked — the import map never installed, and server-rendered styles did not apply until hydration adopted them.

```diff
+let nonce = crypto.getRandomValues(new Uint8Array(16)).toBase64()
+
 let stream = renderToStream(<App />, {
   frameSrc: request.url,
   signal: request.signal,
+  nonce,
 })
```

A `nonce` authored on `<ImportMap>` keeps its own value; the option only fills in the attribute when it is absent. The `#rmx-data` script is left alone because it is an `application/json` data block the browser never executes, so `script-src` does not apply to it. A nonce that changes with every response stays compatible with frame navigation, because the client copies the nonce already on the document's import map script onto the import maps it installs later.
