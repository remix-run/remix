# csrf-middleware

CSRF protection middleware for Remix. It provides synchronizer-token validation backed by session storage, plus origin checks for unsafe requests.

## Features

- **Session-Backed Tokens** - Creates and persists CSRF tokens in `context.session`
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

## Origin Validation

For unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`), the middleware validates request origin.

- Default: same-origin validation when `Origin` or `Referer` is present
- Custom: provide `origin` as string, regex, array, or function
- Missing origin behavior: controlled by `allowMissingOrigin` (default `true`)

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) - Session middleware required by `csrf()`
- [`form-data-middleware`](https://github.com/remix-run/remix/tree/main/packages/form-data-middleware) - Needed for form body token extraction

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
