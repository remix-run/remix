# csp-middleware

Content Security Policy middleware for Remix. It generates a request nonce for handlers and renderers and adds the configured policy to HTML responses.

## Features

- Static policies or a per-request policy factory
- Enforced and report-only policies side by side, sharing one nonce
- Named reporting endpoints for policy violation reports
- HTML-only default with custom response filtering
- Cryptographically random nonces shared with internal frame renders
- Existing policies preserved as separate policies

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

`policy` may be static or a sync/async factory receiving `{ nonce, context }`; `reportOnly` takes the same forms (see [Report-only policies](#report-only-policies)). At least one of them is required. Before the factory or downstream handlers run, `csp()` establishes a base64-encoded nonce with 128 random bits from `crypto.getRandomValues()`.

Inferred directive objects and factory returns reject unknown directive names without annotations. For shared factories, `satisfies CspPolicyFactory` preserves this check; annotations that erase extra keys prevent `csp()` from detecting them.

`render()` applies the nonce to generated import maps, module preloads, and CSS mixin styles. Internal frame requests, including redirects, share the enclosing nonce; independent requests generate fresh values. Authored script and style tags use `getCspNonce(context)`, which returns `undefined` before a nonce is established.

Browser navigation retains the original document's CSP. Matching resource nonces are rewritten only when the response's enforcing CSP identifies one shared nonce. See [client navigation](../component/server/README.md#client-navigation) for island updates, nonce requirements, and custom resolvers.

## Static policies

```ts
csp({
  policy: { defaultSrc: ["'self'"], objectSrc: ["'none'"], upgradeInsecureRequests: true },
})
```

The `policy` and `reportOnly` options also accept a `ContentSecurityPolicy` instance or a serialized single-policy string. The middleware adds no default directives and does not automatically insert nonce sources into your rules. Include them in the factory when your policy requires them.

## Report-only policies

`reportOnly` is a policy, not a mode switch. It is sent as `Content-Security-Policy-Report-Only` alongside the enforced `policy`, so you can keep enforcing what already works while trialling stricter directives. Pair `reportTo` with a named `Reporting-Endpoints` entry to receive violation reports:

```ts
csp({
  policy({ nonce }) {
    return {
      defaultSrc: ["'self'"],
      scriptSrc: [`'nonce-${nonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  },
  reportOnly({ nonce }) {
    return { styleSrc: [`'nonce-${nonce}'`], reportTo: 'csp' }
  },
  reportingEndpoints: { csp: '/csp-reports' },
})
```

Here scripts are restricted to the nonce, while the stricter nonce-only `style-src` is monitored first. Both factories receive the same request nonce. To monitor a whole policy before enforcing anything, pass only `reportOnly`.

`reportingEndpoints` maps names to absolute or relative URLs. The example emits `Reporting-Endpoints: csp="/csp-reports"`. `reportTo` names one endpoint; the application provides the receiving route. The `reportUri` directive supports legacy reporting.

Configured endpoint names override matching downstream entries; other entries are retained. Names must be structured field keys, and URLs must use printable ASCII. Browsers resolve relative URLs against the response URL and require potentially trustworthy endpoints. See the [Reporting API specification](https://www.w3.org/TR/reporting-1/#header).

Separate `csp()` instances also share the request nonce, so policies can be split across middleware layers. Existing CSP headers are preserved as separate policies; browsers apply each policy independently.

## Response scope

Policy and reporting endpoint headers apply only to downstream `text/html` responses by default, including HTML errors. Matching ignores case and parameters such as `charset`. Other responses, including those without a `Content-Type`, are unchanged.

`304 Not Modified` responses are always unchanged, even with a custom filter, so cache revalidation retains the policy matching the cached HTML's nonce.

Use `filter(response)` to replace the default, for example to include worker scripts:

```ts
csp({
  policy: { defaultSrc: ["'self'"] },
  filter(response) {
    let mediaType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
    return mediaType === 'text/html' || mediaType === 'application/javascript'
  },
})
```

`filter: () => true` includes every response type except `304`. The synchronous filter controls both policy and reporting headers. Nonce generation and the policy factory still run before handlers regardless of its result; response bodies are never consumed.

## Custom rendering integrations

Custom renderers read `getCspNonce(context)`. For internal requests embedded in the same document, call `inheritCspNonce(request, nonce)` before passing that exact `Request` to the router. Clones and independent browser requests do not inherit it.

The standard `render()` middleware handles this propagation, including making the inherited value available to `getCspNonce(context)` when a child route does not install CSP middleware itself.

## Related Packages

- [`headers`](../headers/README.md) - Parse and serialize Content Security Policies
- [`render-middleware`](../render-middleware/README.md) - Render components and resolve frames
- [`fetch-router`](../fetch-router/README.md) - Route-scoped middleware and typed request context

## Related Work

- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
