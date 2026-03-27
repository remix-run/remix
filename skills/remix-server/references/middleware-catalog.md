# Middleware Catalog

Use this reference to discover the built-in Remix middleware packages and decide which one belongs
in your request pipeline.

This is a curated index, not a requirement to install everything. Start from the problem you need to
solve, then add only the middleware that actually owns that boundary concern.

## Runtime And Boundary Middleware

### `logger()`

Package: `remix/logger-middleware`

- Use for request/response logging and timing.
- Usually place it near the top of the root middleware stack.
- Best for development, diagnostics, and server observability.
- Avoid treating it as business analytics; keep it about HTTP traffic.

### `compression()`

Package: `remix/compression-middleware`

- Use for response compression based on `Accept-Encoding`.
- Usually place it early in the root stack so it can wrap downstream responses.
- Good for HTML, JSON, and other compressible responses.
- It skips responses that are already compressed or advertise byte ranges.

### `staticFiles(...)`

Package: `remix/static-middleware`

- Use for direct file serving from `public/` or another asset root.
- Usually place it early so static requests can bypass sessions, auth, and body parsing.
- Good for app-owned static assets with HTTP semantics like ETags and range requests.
- Do not use it for uploads processing or private file authorization flows.

### `asyncContext()`

Package: `remix/async-context-middleware`

- Use when helpers deeper in the same async call stack need access to the current request context
  through `getContext()`.
- Usually place it in the root stack before downstream code that relies on async request context.
- Good for app-owned helpers like `getCurrentUser()` when explicitly threading `context` everywhere
  becomes awkward.
- Avoid it as the default pattern; passing `context` directly is simpler when possible.

## Request Parsing And Normalization

### `formData(...)`

Package: `remix/form-data-middleware`

- Use to parse request bodies into `context.get(FormData)`.
- Usually place it before middleware or handlers that read form fields or uploaded files.
- Good for standard HTML forms, multipart uploads, and file-handling workflows.
- Can take an `uploadHandler` plus multipart limits such as `maxFiles` and `maxTotalSize`.

### `methodOverride(...)`

Package: `remix/method-override-middleware`

- Use to simulate `PUT`, `PATCH`, and `DELETE` from browser forms.
- Place it after `formData(...)` because it reads the parsed override field.
- Good for REST-style browser routes that still submit with HTML `<form method="POST">`.
- Do not add it unless the app actually uses method override conventions.

## State And Auth

### `session(...)`

Package: `remix/session-middleware`

- Use to load a session into request context and persist updates automatically.
- Place it before middleware that reads session-backed state.
- Good for flash messages, cart state, browser login state, and other cookie-backed request data.
- It expects a signed cookie configuration; treat that as part of the security boundary.

### `auth(...)`

Package: `remix/auth-middleware`

- Use to resolve request-time auth state and store it at `context.get(Auth)`.
- Place it after the middleware that provides whatever auth depends on, often `session(...)` and
  sometimes database-loading middleware too.
- Good for shared auth resolution across public routes, protected browser routes, and APIs.
- Pair it with route-local `requireAuth()` when only some routes must reject anonymous requests.

## Cross-Origin And Security Middleware

TODO: Add `../../remix-security/SKILL.md` for deeper guidance on choosing security models and
layering these protections once that skill exists.

### `cors(...)`

Package: `remix/cors-middleware`

- Use when browsers on other origins need to call your app.
- Usually place it in the root stack for API routes or other cross-origin surfaces.
- Good for preflight handling, origin allowlists, exposed headers, and credential-aware policies.
- Remember that CORS is browser policy, not business authorization.

### `cop(...)`

Package: `remix/cop-middleware`

- Use for tokenless cross-origin protection based on browser provenance headers and same-origin
  checks.
- Usually place it early so unsafe cross-origin browser requests are rejected before deeper work
  runs.
- Good when the deployment can rely on the modern browser model it assumes.
- Prefer `csrf(...)` or a layered `cop() + csrf()` setup when you need stronger session-backed form
  protection.

### `csrf(...)`

Package: `remix/csrf-middleware`

- Use for synchronizer-token CSRF protection backed by sessions.
- Place it after `session(...)`, and after `formData(...)` if you want body-field token extraction.
- Good for session-backed HTML form workflows and deployments that want conservative CSRF defenses.
- It complements origin checks; it does not replace the need to think about cookie and origin policy.

## Common Combinations

- Browser app with forms: `staticFiles()`, `formData()`, `methodOverride()`, `session()`, `auth()`
- Session-backed forms with CSRF: `formData()`, `session()`, `csrf()`
- Cross-origin API: `cors()`
- Hardened browser form app: `cop()`, `session()`, `csrf()`
- App with deep request-scoped helpers: `asyncContext()`, plus the middleware that populates the
  values those helpers read

## Choosing The Right One

- If the concern is HTTP-wide and applies to every request, prefer root middleware.
- If the concern is authentication or authorization for only one route area, prefer route-local
  middleware like `requireAuth()`.
- If the concern parses or normalizes the incoming request, it should usually run before auth or
  route actions.
- If the concern can short-circuit requests cheaply, place it early.
