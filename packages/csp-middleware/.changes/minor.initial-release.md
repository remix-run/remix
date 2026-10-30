Generate a request nonce and matching Content Security Policy with `csp()` from `remix/middleware/csp`. Supply `policy`, `reportOnlyPolicy`, or both, each static or a sync/async factory receiving `{ nonce, context }`. Inferred directive objects reject unknown names. `render()` reads the nonce automatically; authored tags use `getCspNonce(context)`.

Policies apply to `text/html` responses by default. Override `filter` to include other response types; `304` responses always retain their downstream headers so cached markup keeps its matching policy. Internal frame renders share the enclosing nonce, while independent requests generate fresh values. Existing policies remain separate.

Both policies share the request nonce. Use `reportingEndpoints: { csp: '/csp-reports' }` with `reportTo: 'csp'` to configure reporting. Applications provide the receiving route. Custom server integrations can propagate the nonce with `inheritCspNonce(request, nonce)`.
