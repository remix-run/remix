`render()` reads the nonce established by `csp()` and applies it to generated import maps, module preloads, and CSS mixin styles. Authored tags use `getCspNonce(context)`.

Internal frame requests, including redirects, inherit the document nonce before child handlers run, even on routes without their own CSP middleware. Independent requests receive fresh nonces when they run `csp()`.
