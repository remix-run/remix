---
name: remix-server
description: Build the server/runtime side of a Remix app. Use when creating `server.ts`, composing router middleware, defining request context types, wiring sessions/auth/uploads at the request boundary, or deciding what belongs in middleware versus route code.
---

# Remix Server

Use this skill for the server/runtime shell of a Remix app: request entrypoints, router creation,
global middleware composition, request-scoped context, and runtime-only wiring.

This skill is not the place to design route contracts or render UI. Use
`../remix-project-layout/SKILL.md` for file placement and controller ownership, use
`../remix-routing/SKILL.md` for route contracts and controller mapping, and use
`../remix-ui/SKILL.md` for rendering, layouts, client entries, frames, and interactivity.

## Procedure

1. Start with a small `server.ts` that initializes long-lived resources once, creates the app router
   once, and passes each incoming request to `router.fetch(...)` via
   `createRequestListener(...)`.
2. Put app-wide request concerns in root middleware instead of route handlers:
   logging, static files, compression, form parsing, method override, sessions, auth, request
   context helpers, and similar boundary concerns.
3. Define one app-level request context type from the root middleware tuple and reuse it across
   controllers, middleware, and helpers.
4. Keep route actions thin. Read request-scoped values with `context.get(...)`, then hand off to the
   route owner, data layer, or UI layer instead of reimplementing middleware logic in handlers.
5. Use route-local middleware only for route-local concerns such as `requireAuth()` or
   route-specific validation. If it should run on every request, it belongs in the root stack.
6. Handle runtime failures at the server boundary and return an explicit `500` response instead of
   leaking uncaught errors to the client.

## Typical Shape

```ts
// server.ts
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import { router } from './app/router.ts'

let server = http.createServer(
  createRequestListener((request) => {
    return router.fetch(request)
  }),
)
```

```ts
// app/router.ts
import { createRouter } from 'remix/fetch-router'
import { formData } from 'remix/form-data-middleware'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'

export let router = createRouter({
  middleware: [
    staticFiles('./public'),
    formData(),
    session(sessionCookie, sessionStorage),
    loadAuth(),
  ],
})
```

## Default Ownership

- `server.ts` owns process startup, the long-lived router instance, and the runtime listener.
- `router.ts` owns the root middleware stack and route-to-controller wiring.
- Middleware owns request parsing, request-scoped state, auth/session loading, and cheap
  short-circuit behavior such as static file serving.
- Controllers own route behavior after the request has already been normalized by middleware.

## Future Skill Handoffs

- Use `../remix-routing/SKILL.md` for route contracts, nested route maps, and controller mapping.
- TODO: Add `../remix-data/SKILL.md` for validation, persistence, and data workflows once that
  skill exists.
- TODO: Add `../remix-auth/SKILL.md` and decide whether `remix-sessions` stands alone later.
- TODO: Add `../remix-security/SKILL.md` for choosing CSRF, cross-origin, cookie, and other
  request-boundary security strategies once that skill exists.

## Load These References As Needed

- [./references/middleware-ordering.md](./references/middleware-ordering.md)
  Use for practical middleware ordering, ownership rules, and when a concern belongs in route-local
  middleware instead of the global stack.
- [./references/middleware-catalog.md](./references/middleware-catalog.md)
  Use to discover the built-in middleware packages, what each one does, where it usually belongs in
  the stack, and what it depends on.
- [./references/building-middleware.md](./references/building-middleware.md)
  Use when authoring custom middleware, exposing request-scoped values, short-circuiting requests,
  or deciding whether a concern should be global or route-local.
- [./references/runtime-patterns.md](./references/runtime-patterns.md)
  Use for `server.ts` shape, typed app context patterns, async request context, uploads, testing,
  and runtime-specific notes.
