# Middleware Ordering

Build the root middleware stack from cheapest, broadest boundary concerns down to app-specific
request state.

## Good Default Order

Use this as a practical starting point:

1. Logging and profiling middleware
2. Response-wide wrappers such as compression
3. Static file serving for `public/` or other asset roots
4. Request body parsing such as `formData()`
5. Request normalization that depends on parsed bodies, such as `methodOverride()`
6. Session loading
7. App-level loaders such as database injection or auth resolution
8. Route-local middleware such as `requireAuth()` or route-specific validation

That order is not a law, but the dependencies are real:

- `methodOverride()` belongs after `formData()` because it reads the parsed override field.
- Auth that reads session data belongs after `session(...)`.
- Auth that verifies against a database belongs after the middleware that loads the database into
  request context.
- Static file serving should usually run before sessions, auth, or body parsing so cheap asset
  requests can bypass the rest of the app.

## Async Request Context

Use `asyncContext()` when helpers deeper in the same async call stack need out-of-band access to the
current request context through `getContext()`.

Put it in the root stack before the downstream code that needs it. It stores the live request
context object, so later middleware can still add values that helpers read from that same context.

Do not reach for async request context first. Prefer passing `context` explicitly until that becomes
awkward across many helper layers.

## Global Vs Route-Local

Put a concern in root middleware when it is truly app-wide:

- static files
- request logging
- compression
- form parsing
- sessions
- auth resolution

Keep it route-local when only some routes need it:

- `requireAuth()`
- admin-only checks
- resource-specific validation
- format negotiation unique to one endpoint

## Common Mistakes

- Parsing bodies after the code that expects `context.get(FormData)`.
- Running `methodOverride()` before `formData()`.
- Loading sessions or auth for requests that should have been short-circuited by `staticFiles()`.
- Putting auth checks in every controller instead of resolving auth once in middleware and reading
  `context.get(...)` later.
- Treating middleware as a generic helper bucket instead of a request-boundary pipeline.
