Render with a nonce-based Content Security Policy using `csp()` from `remix/middleware/csp` alongside `render()`. The middleware generates the nonce and policy together; generated import maps, module preloads, and CSS mixin styles receive the nonce automatically. Authored tags use `getCspNonce(context)`.

Policies apply to HTML responses by default, support report-only mode and named reporting endpoints, and leave `304` responses unchanged. Internal frame renders share the document nonce; browser navigation rewrites matching resource nonces when the response's enforcing CSP identifies one shared nonce.

Custom integrations can pass `nonce` directly to `remix/component/server` and build policies with `ContentSecurityPolicy` from `remix/headers/content-security-policy`. See the [middleware guide](https://github.com/remix-run/remix/tree/main/packages/csp-middleware#usage) for configuration.
