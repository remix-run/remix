`remix/component/server` can now render under a Content Security Policy that names a nonce. Pass `nonce` to `renderToStream()` or `renderToString()` and it is stamped on the import map script, module preload links, and the server-rendered `<style>` tags the framework emits (see #11926).

Frame resolvers receive the enclosing nonce in `context.nonce` for forwarding to nested server renders, so blocking-frame CSS mixin styles can satisfy the document's CSP before hydration.

With `render()` from `remix/middleware/render`, `context.render(node, { nonce })` applies the same protection and automatically propagates the nonce through nested frame requests and redirects, including blocking frames.
