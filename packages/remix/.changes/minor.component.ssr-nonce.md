Render with a nonce-based Content Security Policy using `csp()` from `remix/middleware/csp` alongside `render()`. The middleware generates the nonce and policy together; generated import maps, module preloads, and CSS mixin styles receive the nonce automatically. Authored tags use `getCspNonce(context)`.

Policies apply to HTML responses by default, support enforced and report-only policies together with named reporting endpoints, and leave `304` responses unchanged. Internal frame renders share the document nonce. Browser navigation and island updates preserve it when the response's enforcing CSP identifies one shared nonce; server styles must pass the active policy before adoption.

Custom integrations can pass `nonce` directly to `remix/component/server` and build policies with `ContentSecurityPolicy` from `remix/headers/content-security-policy`. See the [middleware guide](https://github.com/remix-run/remix/tree/main/packages/csp-middleware#usage) for configuration.
