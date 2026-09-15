# Auth and Sessions

Read for per-browser state, login, route protection, or cookie-authenticated mutations.

Installed API docs: `src/auth/README.md` for login/provider protocols, `src/auth-middleware/README.md` for identity resolution and protection, `src/session/README.md` and `src/session-middleware/README.md` for storage/commit behavior, and `src/csrf-middleware/README.md` / `src/cop-middleware/README.md` for cross-origin defenses.

## Choose State and Storage Deliberately

- Use a plain cookie for a browser-controlled preference. A signed cookie can protect a small value from tampering; session helpers are preferable when server-managed lifecycle, login, carts, or flash messages are involved.
- Use session middleware to read and save sessions and emit `Set-Cookie`. Actions should not implement a second session commit pipeline.
- A session identifies a browser, not a person. Clearing cookies can bypass session-only submission limits. Durable ownership or quotas need an account and server-side enforcement.
- Use memory storage for isolated tests. Filesystem storage needs durable disk and a topology that can access it. Multi-host apps need shared storage or an appropriate cookie-backed design.
- Signing is not encryption. Do not put confidential provider tokens or other secrets into a merely signed client-readable cookie. Read the storage backend's size, confidentiality, and revocation constraints before choosing it.

## Secure Session Configuration

Define the session cookie and storage in a focused server-only module, such as `app/middleware/session.ts`.

Require session and provider secrets from configuration in non-test environments and fail at startup when missing. Tests should inject an explicit test cookie/storage rather than relying on a production fallback secret. Configure session cookies with `httpOnly`, a deliberate `sameSite` policy (normally `Lax`), `path: '/'`, and `secure` when served over HTTPS. Confirm how TLS termination and trusted proxies affect the app's public origin.

## Connect Sessions, CSRF, and Form Rendering

The preference form in [routing and controllers](routing-and-controllers.md) mutates session state from a cookie-authenticated browser, so it needs CSRF protection before shipping. Add `csrf()` after `session()` and `formData()`, and extend the scaffold's `AppContext` tuple with the new middleware:

```ts
// app/router.ts — middleware setup; keep the app's controller registrations
import { csrf } from 'remix/middleware/csrf'
import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { session } from 'remix/middleware/session'
import { createRouter, type MiddlewareContext } from 'remix/router'

import { assets } from './assets.ts'
import { sessionCookie, sessionStorage } from './middleware/session.ts'

const sessionMiddleware = session(sessionCookie, sessionStorage)
const formDataMiddleware = formData()
const csrfMiddleware = csrf()
const renderMiddleware = render({ assets })
type AppContext = MiddlewareContext<
  [
    typeof sessionMiddleware,
    typeof formDataMiddleware,
    typeof csrfMiddleware,
    typeof renderMiddleware,
  ]
>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({
  middleware: [sessionMiddleware, formDataMiddleware, csrfMiddleware, renderMiddleware],
})
```

Then pass `getCsrfToken(context)` from `remix/middleware/csrf` into the page as a prop and render it as `<input type="hidden" name="_csrf" value={handle.props.csrfToken} />` inside the form. Both the GET and the failed-validation re-render need the token.

The complete request flow is:

1. The GET reads its session and renders the hidden `_csrf` input. Session middleware persists the token and cookie.
2. The browser sends the cookie and token with the POST. `formData()` parses fields before `csrf()` validates them.
3. For account-bound mutations, run `auth({ schemes })` after the middleware its scheme needs, then `requireAuth<Identity>()` on each protected controller. Confirm resource ownership in the action/data write; never trust a submitted owner ID.
4. Validate submitted values with `parseSafe`. On failure, render safe values, accessible errors, and the current token with `400` or `422`. Do not write data on a rejected request.
5. Perform the authorized mutation and return a `303` redirect. The session middleware handles any session changes.

A missing/invalid CSRF token should be a `403`, not an unexpected server error. Configure `csrf({ onError })` when a user-facing recovery response is needed; the user should reload a fresh form rather than silently resubmitting. If that callback needs `context.render`, install render middleware before CSRF.

For enhanced forms, preserve the server's validation and authorization error bodies in the [browser frame resolver](hydration-frames-navigation.md#preserve-form-error-responses), or keep `data-rmx-document`. Tests must retain the GET response's session cookie when submitting its token.

Use `csrf()` as the conservative default for cookie-authenticated forms. A tokenless `cop()` policy is an alternative only when the deployment meets its documented prerequisites. CORS does not replace either defense. Scope browser-session CSRF checks appropriately so unrelated bearer-token APIs and validated external provider callbacks keep their own protocol-specific protections.

## Login and Logout

Use the auth README's provider implementations instead of recreating OAuth/OIDC protocol handling.

- **Credentials:** validate input, use `verifyCredentials(...)`, return a normal failure response for invalid credentials, then call `completeAuth(context)` before storing the minimal app-owned auth record. Keep password verification server-side and do not disclose whether an account exists.
- **External login:** configure providers once using validated secrets and a trusted public callback URL. Use `startExternalAuth(...)` and `finishExternalAuth(...)` for the transaction and protocol checks. Persist the app's user/account association before completing the login. Accept return destinations only under an explicit safe redirect policy.
- **Later requests:** resolve the session record with `createSessionAuthScheme(...)` inside `auth({ schemes })`. Handle absent, invalid, or revoked records. Check stored data rather than asserting that it is a valid user.
- **Privilege changes:** regenerate the session ID and retire the old session as appropriate. `completeAuth()` already requests this for login.
- **Logout:** use a protected mutation, not GET. Destroy the session with `session.destroy()` when all state should be cleared. If retaining non-auth state, clear every auth-related field and regenerate the ID with old-session deletion. Respect the backend's revocation limitations.
- **Flash messages:** use `session.flash(...)` for the next request; do not assume a value flashed now is readable in the same request.

## Verify the Boundary

Test anonymous access, authenticated access, another user's resource, stale/revoked identity, missing/invalid CSRF tokens, login rotation, and logout invalidation where relevant. Nested controllers require their own protection even when their parent controller already has `requireAuth()`.
