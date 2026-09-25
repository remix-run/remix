`renderToStream()` and `renderToString()` now accept a `nonce` and stamp it on the elements they generate themselves: the import map script and the `<style>` tags the `css` mixin emits. Under a `Content-Security-Policy` that names a nonce, those elements were previously blocked — the import map never installed, and server-rendered styles did not apply until hydration adopted them (see #11926).

```diff
+let nonce = crypto.getRandomValues(new Uint8Array(16)).toBase64()
+
 let stream = renderToStream(<App />, {
   frameSrc: request.url,
   signal: request.signal,
+  nonce,
 })
```

A `nonce` authored on `<ImportMap>` keeps its own value; the option only fills in the attribute when it is absent. The `#rmx-data` script is left alone because it is an `application/json` data block the browser never executes, so `script-src` does not apply to it. A nonce that changes with every response stays compatible with frame navigation, because the client uses the original document's import map nonce, falling back to its nonce metadata, for import maps it installs later.

Import maps and preloads from blocking frames are merged into the document head, using the document's import map nonce. Document renders retain the nonce in metadata so client entries introduced by later frames work even when there is no initial import map.
