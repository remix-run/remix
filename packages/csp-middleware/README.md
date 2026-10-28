# csp-middleware

Content Security Policy middleware for Remix. It generates a request nonce, makes it available to handlers and renderers, and adds the configured policy to responses.

## Features

- Static policies or a per-request policy factory
- Enforced or report-only policy headers
- Named reporting endpoints for policy violation reports
- Response filtering to select which responses receive the policy
- Cryptographically random nonces shared with internal frame renders
- Typed nonce access through request context
- Existing policies retain their enforcement or reporting mode

## Installation

```sh
npm i remix
```

## Usage

```tsx
import { createRouter } from 'remix/router'
import { csp, getCspNonce } from 'remix/middleware/csp'
import { render } from 'remix/middleware/render'
import { Frame } from 'remix/component'

let router = createRouter({
  middleware: [
    csp({
      policy({ nonce }) {
        return {
          defaultSrc: ["'self'"],
          scriptSrc: [`'nonce-${nonce}'`],
          styleSrc: [`'nonce-${nonce}'`],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        }
      },
    }),
    render(),
  ],
})

router.get('/', (context) =>
  context.render(
    <html>
      <head>
        <script type="module" src="/app.js" nonce={getCspNonce(context)} />
      </head>
      <body>
        <Frame src="/activity" />
      </body>
    </html>,
  ),
)

router.get('/activity', (context) => context.render(<p>Recent activity</p>))
```

`csp()` takes one configuration object with a required `policy` property. The middleware establishes the nonce before invoking the policy factory or downstream handlers. A factory receives `{ nonce, context }` and may return a promise. The nonce contains 128 bits from `crypto.getRandomValues()` and is base64 encoded.

`csp()` checks inferred directive objects and sync or async factory returns for unknown directive names, using `ContentSecurityPolicyInit` from `remix/headers/content-security-policy` as the source of directive names and value types. Factory return-type annotations are optional. When extracting a shared factory, use `satisfies CspPolicyFactory` to preserve its inferred return type; annotating the variable as `CspPolicyFactory` can hide extra fields before `csp()` sees them. Objects already widened to `ContentSecurityPolicyInit` have the same limitation.

`render()` reads the nonce automatically for generated import maps, module preloads, and CSS mixin styles. Internal frame requests and every redirect reuse the enclosing document's nonce, including blocking and non-blocking frames. Independently requested frames receive fresh nonces. Authored script and style tags use `getCspNonce(context)` explicitly.

Read the nonce with `getCspNonce(context)`. It returns `undefined` when no nonce has been established and does not generate one itself.

## Static policies

```ts
csp({
  policy: { defaultSrc: ["'self'"], objectSrc: ["'none'"], upgradeInsecureRequests: true },
})
```

The `policy` option also accepts a `ContentSecurityPolicy` instance or a serialized single-policy string. The middleware adds no default directives and does not automatically insert nonce sources into your rules. Include them in the factory when your policy requires them.

## Report-only policies

Set `reportOnly: true` to monitor violations using `Content-Security-Policy-Report-Only`:

```ts
csp({
  policy({ nonce }) {
    return {
      defaultSrc: ["'self'"],
      scriptSrc: [`'nonce-${nonce}'`],
      styleSrc: [`'nonce-${nonce}'`],
      reportTo: 'csp',
    }
  },
  reportOnly: true,
  reportingEndpoints: { csp: '/csp-reports' },
})
```

The `reportingEndpoints` option adds the corresponding response header:

```http
Reporting-Endpoints: csp="/csp-reports"
```

Map endpoint names to absolute or relative URLs. Include exactly one matching name in `reportTo`, such as `'csp'`; the middleware does not infer that directive. The option works with enforcing and report-only policies, and `filter(response)` controls both the policy header and reporting endpoints. When omitted or empty, it leaves any existing `Reporting-Endpoints` header unchanged.

Existing endpoint definitions are retained. Configured entries are appended, so a configured name takes precedence over the same name in a downstream header. Names must start with a lowercase letter or `*` and otherwise contain only lowercase letters, digits, `_`, `-`, `.`, or `*`. URL strings must use printable ASCII; percent-encode other characters. The browser resolves relative URLs against the response URL and ignores insecure endpoints. See the [Reporting API specification](https://www.w3.org/TR/reporting-1/#header).

The application owns the route that receives reports. The `reportUri` directive is also available for browsers that need the legacy reporting mechanism. See [Content-Security-Policy-Report-Only](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only) for reporting setup and browser behavior.

Enforcement is the default. Install separate `csp()` instances to enforce one policy and monitor another; both share the request nonce. Report-only mode keeps `getCspNonce(context)` and render integration available, and preserves any existing enforced policy.

## Response scope

By default, the policy and reporting endpoints are added only to downstream responses whose `Content-Type` is `text/html`, including HTML error responses. Media type matching is case-insensitive and ignores parameters such as `charset`. Other responses, including those without a `Content-Type`, are returned unchanged. Install the middleware on the router, controller, or action that owns those responses. Responses created outside the middleware, such as errors handled by an outer layer, are governed by that layer.

Not-modified (`304`) responses are always returned unchanged, preserving the cached HTML's matching policy rather than replacing it with a fresh nonce. This applies to both enforcing and report-only policies and to reporting endpoints, even when a custom filter accepts the response.

Use `filter(response)` to replace the HTML-only default. For example, include JavaScript responses to apply a policy to worker scripts as well as HTML pages:

```ts
csp({
  policy({ nonce }) {
    return {
      defaultSrc: ["'self'"],
      scriptSrc: [`'nonce-${nonce}'`],
      styleSrc: [`'nonce-${nonce}'`],
    }
  },
  filter(response) {
    let mediaType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
    return mediaType === 'text/html' || mediaType === 'application/javascript'
  },
})
```

Use `filter: () => true` to include all response types except `304`. The synchronous filter runs after downstream handlers return a response and before this middleware adds its header. Returning `false` returns that response unchanged, including any existing CSP headers. The filter applies to both enforcing and report-only policies and their reporting endpoints. Nonce generation and the policy factory still run before downstream handlers, so rendering can use the nonce regardless of the filter's result. The middleware does not consume response bodies.

Existing CSP headers are preserved, and the configured policy is appended to the header selected by `reportOnly`. Browsers enforce each enforcing policy and monitor each report-only policy. Multiple CSP middleware instances in one request share a nonce.

## Custom rendering integrations

Read `getCspNonce(context)` when integrating a custom renderer. For internal requests whose HTML will be embedded in the same document, call `inheritCspNonce(request, nonce)` before passing that exact `Request` object to the router. It carries the nonce by object identity, without adding a request header. Request clones and independent browser requests do not inherit it.

The standard `render()` middleware handles this propagation, including making the inherited value available to `getCspNonce(context)` when a child route does not install CSP middleware itself.

## Related Packages

- [`headers`](https://github.com/remix-run/remix/tree/main/packages/headers) - Parse and serialize Content Security Policies
- [`render-middleware`](https://github.com/remix-run/remix/tree/main/packages/render-middleware) - Render components and resolve frames
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Route-scoped middleware and typed request context

## Related Work

- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
