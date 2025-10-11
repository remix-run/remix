# AGENTS.md for the Remix V3 Monorepo

Remix V3 ships a server-first web stack built from composable packages. Use this guide as the source of truth when you are acting as a coding agent so you can bootstrap new sites, deploy demos, and extend the framework without falling back to traditional React SPA patterns.

## Setup commands

- Install dependencies: `pnpm install` (Node.js 22+ is required; pnpm 10 is pinned in `package.json`).
- Type check every workspace package: `pnpm typecheck`.
- Lint the monorepo: `pnpm lint` (uses `eslint.config.js` with zero-warning enforcement).
- Build packaged artifacts: `pnpm build` (recursively runs `build` where available).
- Run the Bookstore demo server: `pnpm --filter bookstore-demo dev`.
- Bundle demo browser assets in a second terminal: `pnpm --filter bookstore-demo dev:browser`.
- Run demo tests: `pnpm --filter bookstore-demo test`.

## Code style

- Strict TypeScript everywhere; prefer explicit return types on exported functions.
- Single quotes, trailing commas, and Prettier defaults enforced via ESLint.
- Prefer functional patterns over shared mutable state; pass context explicitly unless AsyncLocalStorage is needed (`demos/bookstore/app/middleware/context.ts`).
- Keep JSX on the server unless you are creating an interactive island with `hydrated()` from `@remix-run/dom`.

## Quick orientation

- `packages/*`: publishable building blocks (`@remix-run/fetch-router`, `@remix-run/node-fetch-server`, streaming upload helpers, etc.).
- `demos/bookstore`: reference application showing end-to-end routing, middleware, Frames, and hydration.
- `scripts/*`: release automation; changing them typically requires coordination.
- `TUTORIAL.md`: deep dive curriculum—skim Chapters 2–7 when you need implementation references.

## New application playbook

1. **Sketch routes first.** Start a `routes.ts` using `route`, `resources`, and `formAction` from `@remix-run/fetch-router`. The structure you declare here statically types params, links, and handlers.
2. **Create the router shell.** Copy the pattern in `demos/bookstore/app/router.ts`. Call `createRouter({ uploadHandler })`, register global middleware with `router.use(...)`, then `map` each branch to its handler module.
3. **Bind handlers.** Export an object that satisfies `RouteHandlers<typeof routes.someBranch>` so your handler signatures stay in sync with the route tree.
4. **Pick a runtime adapter.** For Node deployments, wrap the router with `createRequestListener` (`demos/bookstore/server.ts`). Alternate hosts only need Fetch compatibility.
5. **Plan for middleware.** Keep authentication, logging, and context state in reusable middleware. Attach them globally or per-route group using the `use` array when exporting handlers.

## Middleware patterns

Middleware in Remix V3 follows a simple signature: `(context, next) => Response | void | Promise<...>`.

**Correct signature:**

```typescript
import type { Middleware } from '@remix-run/fetch-router'

export let myMiddleware: Middleware = (context, next) => {
  // Access request, url, params, formData, etc. from context
  // Call next() to continue the chain
  return next()
}
```

**Common patterns:**

- **Context storage** (`demos/bookstore/app/middleware/context.ts`): Use `AsyncLocalStorage` to make `RequestContext` available throughout the request lifecycle without prop drilling.
- **Early returns**: Return a `Response` directly to short-circuit the chain (e.g., auth failures, redirects).
- **Augment context**: Call `next({ params: { ...context.params, userId: '123' } })` to merge additional context downstream.
- **Wrap execution**: Use `storage.run(data, () => next())` to provide async context to all downstream code.

**Attachment points:**

- **Global**: `router.use(middleware)` applies to all routes.
- **Route group**: Export `{ use: [middleware], handlers: {...} }` from a handler module.
- **Single route**: Export `{ use: [middleware], handler: (context) => {...} }` for one route.

**Reference implementations:**

- `demos/bookstore/app/middleware/context.ts` — AsyncLocalStorage pattern
- `packages/fetch-router/src/lib/middleware/logger.ts` — Logging with response interception

## Server-driven UI, not a React SPA

- Render HTML on the server using `render()` (`demos/bookstore/app/utils/render.ts`). No client router, no `useEffect` hydration cascades.
- Use `<Frame>` from `@remix-run/dom` when a section of the page should load asynchronously or be refreshed without a full page swap. Frames fetch fully-rendered HTML from server fragment routes such as `routes.fragments.bookCard`.
- Wrap interactive islands with `hydrated()` (see `demos/bookstore/app/assets/image-carousel.tsx`). The controller runs only in the browser; the view renders on both server and client.
- Favor progressive enhancement: start with plain form submissions and links; reach for Frames or hydrated islands only when interaction requires it.

## Forms, uploads, and data flow

- Route handlers receive parsed `FormData` and URL params via the `RequestContext`. Use helpers like `html()`, `json()`, and `redirect()` to build `Response` objects.
- Streaming uploads are configured once via the router’s `uploadHandler` (`demos/bookstore/app/utils/uploads.ts`). Files stream to `LocalFileStorage` or your custom storage without buffering entire payloads in memory.
- Data access lives in `demos/bookstore/app/models/*`. Swap in your own persistence layer by changing these modules; handlers stay the same.
- Sessions are cookie-backed via utilities in `demos/bookstore/app/utils/session.ts`. Middleware can read and extend `context.storage` so handlers, Frames, and hydrated components all see consistent state.

## Testing strategy

- Prefer calling `router.fetch()` directly in tests (`demos/bookstore/test/helpers.ts`) to exercise routing, middleware, and handlers without an HTTP server.
- Capture and replay cookies to simulate authenticated flows. Use standard Web Request objects in tests so code stays runtime-agnostic.
- When adding features, pair a focused `router.fetch()` test with any necessary unit tests for model utilities.

## Deployment checklist

- [ ] Confirm the runtime adapter matches your host (Node `createRequestListener`, or a Fetch-compatible alternative).
- [ ] Provide environment variables at runtime; no build-time injection required.
- [ ] Ensure logging middleware scrubs PII in production while keeping verbose output in development.
- [ ] Swap `LocalFileStorage` for your production storage driver if uploads must persist beyond process lifetime.
- [ ] Add automated smoke tests that issue representative `router.fetch()` calls before release.

## Agent quick actions

- **Add a feature page:** Extend `routes.ts`, scaffold a handler module, render with server JSX, and cover it with a `router.fetch()` test.
- **Protect a section:** Add auth middleware in `app/middleware`, attach it via the `use` array on the handler export, and test both authorized and unauthorized responses.
- **Introduce interactivity:** Wrap the target markup in a `hydrated()` component; keep server rendering intact and limit client state to what the controller manages.
- **Spin up a new demo:** Duplicate the bookstore structure, rename the workspace in `package.json`, and reuse the router/middleware/upload scaffolding.

## Keep this file current

Agents rely on this document over generic README steps. Update the relevant sections whenever scripts change, new middleware becomes mandatory, or new packages appear in `packages/*`. Think of it as the briefing you would give a new teammate before handing them the keyboard.
