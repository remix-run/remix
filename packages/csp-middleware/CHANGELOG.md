# csp-middleware

## v1.0.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@1.0.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@1.0.1)
  - [`headers@1.1.1`](https://github.com/remix-run/remix/releases/tag/headers@1.1.1)

## v1.0.0

### Major Changes

- Generate a request nonce and matching Content Security Policy with `csp()` before `render()`: ([#12098](https://github.com/remix-run/remix/pull/12098))

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

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`headers@1.1.0`](https://github.com/remix-run/remix/releases/tag/headers@1.1.0)

## Unreleased
