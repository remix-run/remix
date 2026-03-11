# csrf-middleware

CSRF protection middleware for Remix. It provides synchronizer-token validation backed by session storage, plus origin checks for unsafe requests.

## Features

- **Session-Backed Tokens** - Creates and persists CSRF tokens in the request session
- **Flexible Token Extraction** - Reads tokens from headers, form fields, query params, or a custom resolver
- **Origin Validation** - Validates `Origin`/`Referer` for unsafe methods with customizable policies
- **Configurable Enforcement** - Control safe methods, token keys, and failure responses

## Installation

```sh
npm i remix
```

## Usage

This middleware requires [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) to run before it.

```ts
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { createCookieSessionStorage } from 'remix/session/cookie-storage'
import { session } from 'remix/session-middleware'
import { csrf, getCsrfToken } from 'remix/csrf-middleware'

let sessionCookie = createCookie('__session', { secrets: ['secret1'] })
let sessionStorage = createCookieSessionStorage()

let router = createRouter({
  middleware: [session(sessionCookie, sessionStorage), csrf()],
})

router.get('/form', (context) => {
  let token = getCsrfToken(context)

  return new Response(`
    <form method="post" action="/submit">
      <input type="hidden" name="_csrf" value="${token}" />
      <button type="submit">Submit</button>
    </form>
  `)
})
```

## Token Sources

By default, `csrf()` checks token values in this order:

1. Request headers: `x-csrf-token`, `x-xsrf-token`, `csrf-token`
2. Form field: `_csrf` (requires `formData()` middleware to parse request bodies)
3. Query param: `_csrf`

You can override extraction using `value(context)`.

Headers and form fields are the preferred transports. Query param fallback exists for compatibility, but it is the weakest option because tokens are more likely to be exposed in logs, history, and copied URLs.

## Origin Validation

For unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`), the middleware validates request origin.

- Default: same-origin validation when `Origin` or `Referer` is present
- Custom: provide `origin` as string, regex, array, or function
- Missing origin behavior: controlled by `allowMissingOrigin` (default `true`)

## Caveats

- The synchronizer token is the primary defense in `csrf()`. `Origin` and `Referer` checks are an additional signal, not the only protection.
- By default, unsafe requests with a valid token still pass when `Origin` and `Referer` are both missing. Set `allowMissingOrigin: false` if your deployment wants to require provenance headers on unsafe requests.
- Query param tokens are supported for compatibility, but they should not be the default recommendation. Prefer headers or hidden form fields when you control the client.
- If you want to reject more unsafe requests before token validation, especially when browser provenance headers are available, layer [`cop-middleware`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware) in front of `csrf()`.

## Why This Exists

Modern browsers now provide stronger cross-origin signals like `Sec-Fetch-Site`, and explicit
`SameSite=Lax` cookies already block many CSRF attacks. We have considered the lighter,
tokenless model used by Go's `CrossOriginProtection`, and we think it is a good fit when a
deployment can make all of the guarantees that model depends on.

Remix cannot assume those guarantees for every app. `csrf()` still exists as the conservative
option for apps that want synchronizer tokens in addition to origin checks, especially for
session-backed HTML form workflows and mixed deployment environments.

If your deployment can guarantee the prerequisites for the tokenless model, this middleware is
optional. In that case, [`cop-middleware`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware)
may be a better fit.

## Related Packages

- [`cop-middleware`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware) - Middleware for tokenless cross-origin protection using browser provenance headers
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) - Session middleware required by `csrf()`
- [`form-data-middleware`](https://github.com/remix-run/remix/tree/main/packages/form-data-middleware) - Needed for form body token extraction

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
