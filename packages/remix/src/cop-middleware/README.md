# cop-middleware

Cross-origin protection middleware for Remix. It mirrors Go's `CrossOriginProtection` by rejecting unsafe cross-origin browser requests without synchronizer tokens.

## Features

- **Browser Provenance Checks** - Uses `Sec-Fetch-Site` when present and falls back to `Origin`
- **Trusted Origins** - Allow specific cross-origin callers by exact origin
- **Explicit Escape Hatches** - Support insecure bypass patterns for endpoints like webhooks
- **No Session State** - Does not require synchronizer tokens or server-side CSRF storage

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
import { cop } from 'remix/cop-middleware'

let router = createRouter({
  middleware: [cop()],
})
```

## Behavior

For unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`), `cop()` follows the same broad model as Go's `CrossOriginProtection`:

- Allow `Sec-Fetch-Site: same-origin`
- Allow `Sec-Fetch-Site: none`
- Reject other `Sec-Fetch-Site` values unless the request matches a trusted origin or insecure bypass
- If `Sec-Fetch-Site` is missing, compare `Origin` to the request host
- If both `Sec-Fetch-Site` and `Origin` are missing, allow the request

This middleware is intentionally tokenless. If you cannot guarantee the deployment assumptions behind that model, prefer [`csrf-middleware`](https://github.com/remix-run/remix/tree/main/packages/csrf-middleware).

## Caveats

- `cop()` is a browser-origin guard, not a universal CSRF solution. It is designed for deployments that can rely on modern browser provenance signals and same-origin request handling.
- If both `Sec-Fetch-Site` and `Origin` are missing on an unsafe request, `cop()` allows the request to continue. This is intentional so older clients and non-browser callers do not fail closed by default.
- If `Sec-Fetch-Site` is missing, `cop()` only rejects when `Origin` is present and does not match the request host.
- If you need stronger guarantees for session-backed form workflows, mixed deployment environments, or requests that should not fall through when browser provenance headers are missing, use [`csrf-middleware`](https://github.com/remix-run/remix/tree/main/packages/csrf-middleware) or layer both middlewares together.

## Using with csrf-middleware

You can also layer `cop()` in front of `csrf()` when you want both browser provenance checks and session-backed synchronizer tokens.

```ts
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { createCookieSessionStorage } from 'remix/session/cookie-storage'
import { session } from 'remix/session-middleware'
import { cop } from 'remix/cop-middleware'
import { csrf } from 'remix/csrf-middleware'

let sessionCookie = createCookie('__session', { secrets: ['secret1'] })
let sessionStorage = createCookieSessionStorage()

let router = createRouter({
  middleware: [cop(), session(sessionCookie, sessionStorage), csrf()],
})
```

In this setup, `cop()` runs first and rejects unsafe cross-origin browser requests early using `Sec-Fetch-Site` and `Origin`. Requests that pass `cop()` continue into `csrf()`, which still enforces synchronizer-token validation and origin checks for the remaining traffic.

## Trusted Origins

```ts
import { createRouter } from 'remix/fetch-router'
import { cop } from 'remix/cop-middleware'

let router = createRouter({
  middleware: [
    cop({
      trustedOrigins: ['https://admin.example.com'],
    }),
  ],
})
```

Trusted origins must be exact origin values in the form `scheme://host[:port]`.

## Insecure Bypass Patterns

Bypass patterns intentionally weaken protection for specific endpoints. They support:

- Optional method prefixes, for example `POST /webhooks/{provider}`
- Exact paths, for example `/healthz`
- Trailing-slash subtree patterns, for example `/webhooks/`
- Single-segment wildcards with `{name}`
- Tail wildcards with `{name...}`

```ts
import { createRouter } from 'remix/fetch-router'
import { cop } from 'remix/cop-middleware'

let router = createRouter({
  middleware: [
    cop({
      insecureBypassPatterns: ['POST /webhooks/{provider}', '/healthz'],
    }),
  ],
})
```

## Related Packages

- [`csrf-middleware`](https://github.com/remix-run/remix/tree/main/packages/csrf-middleware) - Session-backed CSRF protection with synchronizer tokens
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
