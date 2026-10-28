Generate Content Security Policies and request nonces with `csp({ policy, reportOnly, reportingEndpoints, filter })`. The required `policy` accepts static rules, a serialized policy, a `ContentSecurityPolicy` instance, or a per-request factory. A factory receives `{ nonce, context }` so the header and rendered markup can use the same nonce.

Inferred directive objects and sync or async factory returns reject unknown directive names without requiring a return-type annotation. Directive names and value types come from `ContentSecurityPolicyInit` in `@remix-run/headers`.

Handlers can read `getCspNonce(context)` for authored script and style tags. The middleware generates fresh cryptographic nonces for independent requests, reuses inherited nonces for internal frame renders, and preserves existing CSP headers as separate policies. By default, it adds the policy only to responses with a `text/html` content type without consuming the body. Supply `filter(response)` to replace that default and include other responses, such as worker scripts; returning `false` leaves the response unchanged while keeping the nonce available to downstream handlers.

Set `{ reportOnly: true }` to send `Content-Security-Policy-Report-Only`. Enforced and report-only middleware instances can coexist and share the request nonce while preserving existing headers.

Configure `reportingEndpoints: { csp: '/csp-reports' }` alongside `reportTo: 'csp'` in the policy to emit `Reporting-Endpoints`. Endpoint names map to absolute or relative URLs. Existing endpoints are preserved unless configured with the same name, and the response filter controls both headers. Applications provide the route that receives reports.

Not-modified (`304`) responses retain their downstream headers unchanged even when a custom filter accepts them, so cache revalidation keeps the policy matching the cached HTML nonce. This applies to enforcing policies, report-only policies, and reporting endpoints.
