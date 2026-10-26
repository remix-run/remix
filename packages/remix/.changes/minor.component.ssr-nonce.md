`remix/component/server` can now render under a Content Security Policy that names a nonce. Pass `nonce` to `renderToStream()` or `renderToString()` and it is stamped on the import map script, module preload links, and the server-rendered `<style>` tags the framework emits (see #11926).

Frame resolvers receive the enclosing nonce in `context.nonce` for forwarding to nested server renders, so blocking-frame CSS mixin styles can satisfy the document's CSP before hydration.
