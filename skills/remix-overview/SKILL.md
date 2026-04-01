---
name: remix-overview
description: Explain Remix as a fullstack web framework and route broad app-building tasks to the right Remix skills. Use when starting a new Remix app, orienting to the framework, scoping a feature, or deciding whether work belongs in project layout, UI, server, routing, data, auth, files, or security.
---

# Remix Overview

Treat Remix as a fullstack app framework with focused subsystems. Use this skill to build the
mental model, identify the main subsystem involved in the task, and choose the next skill. Do not
try to teach every subsystem in detail here.

## Core Model

- Treat Remix as a fullstack app framework with clear subsystems: server, routing, data, UI, auth,
  files, and security.
- Build around the runtime request flow first: request handling, middleware, route ownership, data
  access, rendering, then optional client-side enhancement.
- Prefer standard Web APIs such as `Request`, `Response`, `URL`, `Headers`, `FormData`, and `File`
  across app code so the same mental model works on both the server and in the browser.
- Think in terms of one cohesive app made from focused Remix subsystems, not a pile of unrelated
  packages or one-off patterns.
- When the app uses the `remix` package, prefer `remix/...` imports over reaching for
  `@remix-run/...` package names by default.
- If a task introduces client-side enhancement plus a new module on disk, consult both the UI and
  project-layout skills before editing.
- Use this skill to orient and route; switch to narrower skills once the task is clearly about
  layout, UI, or another subsystem.

## Request Flow

Use this as the default mental model:

1. A request reaches the Remix server runtime.
2. Middleware composes request concerns such as sessions, auth, parsing, logging, uploads, and
   security.
3. The router matches a typed route and dispatches to the owning controller or action.
4. The route reads or mutates data.
5. The app renders UI with the Remix Component model.
6. Optional client behavior enhances the page through client entries, navigation, frames, or other
   browser-owned behavior.

## Major Subsystems

- Structure and code ownership
  Use `../remix-project-layout/SKILL.md` for where code belongs on disk, route ownership, naming
  conventions, and how structure should evolve as the app grows.
- UI rendering and client behavior
  Use `../remix-ui/SKILL.md` for pages, layouts, rendering, interactions, frames, navigation
  behavior, client entries, and UI tests.
- Styling and visual states
  Use `../remix-styling/SKILL.md` for layout, spacing, colors, typography, responsive behavior, and
  visual polish.
- Server and middleware
  Use `../remix-server/SKILL.md` for Fetch server setup, middleware composition, request context,
  and runtime wiring.
- Routing and controller contracts
  Use `../remix-routing/SKILL.md` for route contracts, nested route structure, controller mapping,
  and URL ownership.
- Data and persistence
  TODO: Add `remix-data` for schema validation, form-data decoding, query/persistence patterns,
  migrations, and seeding.
- Authentication and sessions
  TODO: Add `remix-auth` and decide how `remix-sessions` should be represented.
- Files, uploads, and asset delivery
  TODO: Add `remix-files-assets` for static files, uploads, storage, and asset handlers.
- Security
  TODO: Decide whether `remix-security` should stand alone or remain part of `remix-server`.

## Route Broad Tasks

- If the task is "start a new app" or "where should this code live?", use
  `../remix-project-layout/SKILL.md`.
- If the task is "build this screen", "add interactivity", or "wire client behavior", use
  `../remix-ui/SKILL.md`.
- If the task is "style this UI", "polish this page", or "adjust spacing, colors, or responsive
  behavior", use `../remix-styling/SKILL.md`.
- If the task involves `clientEntry(...)`, hydration, browser-owned modules, or deciding where a
  new interactive module should live, use both `../remix-ui/SKILL.md` and
  `../remix-project-layout/SKILL.md`.
- If the task is "how should I test this UI?" or "how do I verify this interaction?", use
  `../remix-ui/SKILL.md`.
- If the task is "wire the request pipeline", "set up `server.ts`", "compose middleware", or
  "define request-scoped context", use `../remix-server/SKILL.md`.
- If the task is "define this URL space", "author `app/routes.ts`", "generate links from the route
  contract", or "map controllers to routes", use `../remix-routing/SKILL.md`.
- If the task is "how should I test this request flow?" or "where should runtime integration checks
  live?", use `../remix-server/SKILL.md`.
- If the task spans multiple subsystems, use this overview to identify the main workstreams first,
  then hand off to narrower skills.
