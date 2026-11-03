Generate a request nonce and matching Content Security Policy with `csp()` before `render()`:

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

Generated resources receive the nonce automatically; authored tags use `getCspNonce(context)`. See the [CSP middleware docs](https://github.com/remix-run/remix/tree/main/packages/csp-middleware#usage) for setup, report-only policies, and reporting.
