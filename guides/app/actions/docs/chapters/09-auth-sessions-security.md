---
title: Auth, Sessions, and Security
description: How Remix stores per-browser state, resolves identity, protects routes, and defends browser request boundaries.
---

A signed cookie, a session, and an authenticated identity are different layers. Build them in that order, then add authorization and browser-origin defenses around the routes that mutate state.

## Plain cookies and sessions {#cookies-vs-sessions}

Use `remix/cookie` for a browser-controlled preference or one small signed value. Use `remix/session` when state needs server-managed lifecycle, flash values, ID rotation, or tamper-resistant storage such as login state and carts.

## Cookie configuration and secret rotation {#cookie-configuration-and-secret-rotation}

Set `httpOnly`, `sameSite`, `secure`, `path`, and expiry deliberately. Require secrets outside tests, put the newest signing secret first during rotation, and remember that signing prevents tampering but does not hide cookie contents.

## Session middleware and storage strategies {#session-storage-strategies}

`session(cookie, storage)` reads state into request context and persists changes onto the response. Compare cookie, filesystem, memory, Redis, and Memcache storage by size, durability, runtime, and whether multiple app processes must share state.

## Session values, flash data, rotation, and destruction {#flash-messages}

Cover `get`, `set`, `unset`, one-request `flash`, `regenerateId(true)`, and `destroy()`. Rotate after login and other privilege changes, and destroy or rotate on logout instead of only removing one identity field.

## Credentials login and logout {#credentials-auth}

Parse credentials with a form schema, verify them with `createCredentialsAuthProvider()` and `verifyCredentials()`, then call `completeAuth()` before writing the app-owned auth record. The route owns redirects and user-facing failures; the provider owns verification.

## OAuth and OIDC login {#oauth-and-oidc-providers}

Create providers once at module scope, start the redirect with `startExternalAuth()`, finish the callback with `finishExternalAuth()`, resolve the provider profile to a local account, and complete the session. Cover built-in providers, custom OIDC providers, stored token bundles, and `refreshExternalAuth()`.

## Resolve request identity with auth middleware {#request-auth-schemes}

`auth({ schemes })` tries session, bearer-token, API-key, or custom schemes in order and stores success or failure in `context.auth`. Keep login protocol work in `remix/auth` and request-time identity resolution in `remix/middleware/auth`.

## Protect routes with requireAuth {#route-protection-with-requireauth}

Use `requireAuth()` as controller or action middleware and customize `onFailure` for HTML redirects, frame HTML, or API `401` responses. Protection on one controller does not flow into controllers mapped for nested route maps.

## Authorize each resource operation {#authorization-checks}

Authentication says who made the request; authorization decides whether that identity may read or mutate this record. Check ownership, role, tenant, and state transitions inside the action or data write even when `requireAuth()` already ran.

## CSRF synchronizer tokens {#csrf-protection}

Run session middleware before `csrf()`, and form parsing before token extraction from `_csrf`. Explain header and hidden-field transports, same-origin checks, missing-origin policy, and why state-changing cookie-authenticated requests need a deliberate defense.

## Tokenless cross-origin protection {#cross-origin-protection}

Use `cop()` when the deployment can rely on `Sec-Fetch-Site` and `Origin`, or layer it before `csrf()` for an early provenance check plus synchronizer tokens. Treat trusted origins and insecure bypass patterns as narrow security exceptions.

## CORS is not authentication or CSRF protection {#cors}

Use `cors()` only for endpoints browsers must call cross-origin. Configure exact origin, credential, header, and preflight policies; CORS response headers do not authorize a caller and do not stop non-browser clients from reaching an endpoint.
