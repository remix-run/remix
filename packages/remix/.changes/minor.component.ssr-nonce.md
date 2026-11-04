Protect apps with a nonce-based Content Security Policy using `csp()` from `remix/middleware/csp`. Add it before `render()` and it generates a nonce for each request along with a matching policy. Generated import maps, module preloads, and `css()` styles receive the nonce automatically, and authored tags can read it with `getCspNonce(context)`:

```ts
import { createRouter } from 'remix/router'
import { csp } from 'remix/middleware/csp'
import { render } from 'remix/middleware/render'

let router = createRouter({
  middleware: [
    csp({
      policy: ({ nonce }) => ({
        scriptSrc: [`'nonce-${nonce}'`],
        styleSrc: [`'nonce-${nonce}'`],
      }),
    }),
    render(),
  ],
})
```

Frames rendered on the server share the document's nonce, and client navigation keeps it across frame and island updates. HMR updates that add imports and `remix/multiple-import-maps-polyfill` also work under a strict policy, including one without `'unsafe-eval'`. The middleware supports report-only policies and reporting endpoints; see the [CSP middleware docs](https://github.com/remix-run/remix/tree/main/packages/csp-middleware#usage) for setup.

Custom integrations can pass `nonce` to `renderToStream()` or `renderToString()` from `remix/component/server` and build policies with `ContentSecurityPolicy` from `remix/headers/content-security-policy`.
