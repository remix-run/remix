`render()` now reads the CSP nonce from request context and applies it to generated import maps, module preloads, and CSS mixin styles. Install `csp()` alongside `render()` to generate a per-request nonce and its matching policy header.

Internal frame requests and every redirect inherit the document nonce before child middleware and handlers run. Authored tags can read the same value with `getCspNonce(context)`, including on child routes without their own CSP middleware. Independent browser requests receive fresh nonces. `context.render(node, init)` continues to accept standard `ResponseInit` options.

During document navigation and frame reloads, the client reads the nonce from the response's enforcing CSP header to keep authored nonce-bearing styles compatible with the active document policy. Only resource elements matching a single shared response nonce are translated to the original document nonce.
