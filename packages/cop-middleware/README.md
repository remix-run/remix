# cop-middleware

Cross-origin protection middleware for Remix. It mirrors Go's `CrossOriginProtection` by
rejecting unsafe cross-origin browser requests without synchronizer tokens.

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

For unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`), `cop()` follows the same broad model as
Go's `CrossOriginProtection`:

- Allow `Sec-Fetch-Site: same-origin`
- Allow `Sec-Fetch-Site: none`
- Reject other `Sec-Fetch-Site` values unless the request matches a trusted origin or insecure bypass
- If `Sec-Fetch-Site` is missing, compare `Origin` to the request host
- If both `Sec-Fetch-Site` and `Origin` are missing, allow the request

This middleware is intentionally tokenless. If you cannot guarantee the deployment assumptions
behind that model, prefer [`csrf-middleware`](https://github.com/remix-run/remix/tree/main/packages/csrf-middleware).

## Trusted Origins

```ts
import { createRouter } from 'remix/fetch-router'
import { CrossOriginProtection } from 'remix/cop-middleware'

let protection = new CrossOriginProtection({
  trustedOrigins: ['https://admin.example.com'],
})

let router = createRouter({
  middleware: [protection.middleware()],
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
let protection = new CrossOriginProtection({
  insecureBypassPatterns: ['POST /webhooks/{provider}', '/healthz'],
})
```

## Related Packages

- [`csrf-middleware`](https://github.com/remix-run/remix/tree/main/packages/csrf-middleware) - Session-backed CSRF protection with synchronizer tokens
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
