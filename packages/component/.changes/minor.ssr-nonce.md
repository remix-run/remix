`renderToStream()` and `renderToString()` now accept a `nonce` and stamp it on the elements they generate themselves: the import map script, module preload links, and the `<style>` tags the `css` mixin emits. Under a `Content-Security-Policy` that names a nonce, those elements were previously blocked — import maps and preloads could not load, and server-rendered styles did not apply until hydration adopted them (see #11926).

```diff
+let nonce = crypto.getRandomValues(new Uint8Array(16)).toBase64()
+
 let stream = renderToStream(<App />, {
   frameSrc: request.url,
   signal: request.signal,
+  nonce,
 })
```

A `nonce` authored on `<ImportMap>` keeps its own value; the option only fills in the attribute when it is absent. The `#rmx-data` script is left alone because it is an `application/json` data block the browser never executes, so `script-src` does not apply to it. A nonce that changes with every response stays compatible with frame navigation, because the client uses the original document's import map nonce, falling back to its nonce metadata, for import maps and module preloads it installs later.

Import maps and preloads from blocking frames are merged into the document head. Hoisted preloads use the enclosing render's nonce, and an authored document import map keeps its own nonce. Document renders retain the nonce in metadata so client entries introduced by later frames work even when there is no initial import map.
