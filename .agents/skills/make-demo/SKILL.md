---
name: make-demo
description: Create or revise demos in the Remix repository. Use when adding a new demo under demos/, updating an existing demo, or reviewing demo code to ensure it showcases Remix packages, strong code hygiene, and production-quality patterns.
---

# Make Demo

## Overview

Demos in this repository are not throwaway prototypes. They are durable code artifacts that should teach people and other agents how to write Remix code well.

A good demo should:

- exercise Remix framework behavior in a realistic way
- push the target APIs through meaningful edge cases and composition points
- model clean structure, naming, and accessibility
- be code that a reader could adapt into a real application

## Workflow

1. Read the target APIs and at least one or two existing demos before writing new code.
2. Choose a focused scenario that exists to demonstrate Remix behavior, not a generic app shell.
3. Build the demo under `demos/<name>/` using the same conventions as the existing demos.
4. Treat the code as a reference artifact, not as temporary sample code.
5. Validate the demo locally before finishing.

## Rules

- Use Remix library packages for the demo's framework behavior. Do not introduce unrelated routers, component frameworks, state managers, or middleware stacks that distract from the Remix patterns being demonstrated.
- Treat each demo as its own pnpm workspace consumer. Give it a normal `package.json` with `remix` as a dependency when appropriate, and import from package exports such as `remix/ui` instead of reaching back into `packages/` with relative imports.
- Keep any non-Remix dependency incidental to the runtime environment only. If a database driver, asset bundler, or type package is needed, it should support the demo rather than define its architecture.
- Demos should push Remix to its limits in a focused way. Prefer realistic edge cases, composition, streaming, middleware, routing, navigation, forms, or request-handling scenarios over toy examples.
- When demos use `remix/ui`, prefer idiomatic Remix component patterns. Use normal JSX composition and built-in styling/mixin props such as `css={...}` or `mix={css(...)}` and `mix={[...]}` instead of dropping down to manual DOM mutation or ad hoc class management.
- When a demo uses `remix/ui` JSX, configure that demo's `tsconfig.json` with `jsx: "react-jsx"`, `jsxImportSource: "remix/ui"`, and `preserveSymlinks: true`. Do not add `paths` entries that point back into `packages/remix/src`. The goal is for TypeScript to resolve `remix` through the demo's own `node_modules` view, not through repo-relative source paths.
- For HTML responses rendered with `remix/ui`, prefer a tiny local `render()` helper that calls `renderToStream(...)` and wraps it with `createHtmlResponse(...)` from `remix/response/html` instead of manually building HTML `Response` headers or wrapping the stream yourself.
- Prefer direct use of Remix and package APIs in demo code. Do not add custom wrappers around simple calls like `session.get()`, `session.set()`, `session.flash()`, `session.unset()`, `redirect()`, or `context.get(...)` unless the wrapper adds real domain logic, reusable policy, or a genuinely clearer abstraction.
- Demo code must have good hygiene. Use clear names, small focused modules, explicit control flow, and accessible markup. Avoid hacks, dead code, unexplained shortcuts, or patterns that would be poor examples for users to copy.
- Make the demo teach good patterns. Assume readers and future agents will study it as an example of how Remix code should be written in this repository.
- All demo servers should use port `44100`.
- Demo servers should handle `SIGINT` and `SIGTERM` cleanly by closing the server and exiting.

## Typical Structure

Use only the files the scenario needs, but prefer this shape:

- `demos/<name>/package.json`
- `demos/<name>/tsconfig.json` when the demo has TypeScript or JSX source
- `demos/<name>/server.ts`
- `demos/<name>/README.md`
- `demos/<name>/app/`
- `demos/<name>/public/` when serving built assets or other static files

## Remix Application Layout

When a demo is a real application, prefer a uniform Remix application layout instead of inventing a new structure for each demo.

### Root layout

Use these root directories consistently:

- `app/` for runtime application code
- `db/` for database artifacts such as migrations and local SQLite files
- `test/` for shared test helpers, fixtures, and any true cross-application integration tests
- `public/` for static files served as-is
- `tmp/` for runtime scratch files such as sessions, uploads, and caches

### App layout

Inside `app/`, organize code by responsibility:

- `actions/` for all controller-owned route actions and route-local UI/helpers. The root route map lives in `actions/controller.tsx`; nested route maps live in route-key folders such as `actions/auth/controller.tsx` or `actions/account/controller.tsx`
- `data/` for runtime data definitions such as table schema and setup helpers used by the application at startup
- `middleware/` for request-layer concerns such as auth, database injection, sessions, and other request lifecycle setup
- `ui/` for shared UI primitives used across route areas
- `utils/` for shared runtime support code that does not clearly belong to one of the other app layers

### Naming and ownership rules

- Keep controllers thin. They should read request context, talk to the database or other runtime services, and return a response.
- `actions/controller.tsx` owns top-level leaf route actions, and each nested route map gets its own explicit `actions/<route-key>/controller.tsx` file. A controller's `actions` object contains direct leaf route keys from the route map passed to its `router.map()` call.
- Name directories under `app/actions/` after route-map keys, not URL path segments.
- If a component or helper is only used by one controller feature, keep it in that controller feature folder.
- If UI is shared across route areas, keep it in `app/ui/`.
- Do not put shared UI under `app/actions/`, and do not create a generic `app/components/` dumping ground.
- Do not create a generic `app/lib/` dumping ground.
- Avoid feature barrel files such as `index.ts`. Import feature modules directly.
- If a non-UI helper is shared only by controllers, keep it under `actions/`.
- If a helper is part of request or session setup, keep it under `middleware/`.
- Keep table definitions, row types, and runtime database setup in `app/data/`.
- Keep database artifacts such as migrations and SQLite files in `db/`.
- Use `utils/` only for genuinely cross-layer support code. Prefer a topic-specific name like `utils/external-auth.ts` over catch-all names like `helpers.ts` or `misc.ts`.
- Co-locate tests with the app modules they cover whenever those tests primarily exercise one implementation file or one small feature area.
- Use the root `test/` directory only for shared test code, fixtures, and truly broad integration coverage that does not belong to a single app module.

### Example layout

```text
demos/<name>/
  app/
    router.ts
    router.test.ts
    routes.ts

    actions/
      render.tsx

      controller.tsx

      auth/
        controller.tsx
        signup/
          controller.tsx
        resolve-external-auth.ts

      account/
        controller.tsx
        account-page.tsx

    data/
      schema.ts
      setup.ts
      setup.test.ts

    middleware/
      auth.ts
      database.ts
      session.ts

    utils/
      auth-session.ts
      auth-session.test.ts
      password-hash.ts
      external-auth.ts

    ui/
      auth-card.tsx
      document.tsx
      form-field.tsx
      notice.tsx
      icons.tsx
      design-system.ts

  db/
    migrations/
    app.sqlite

  test/
    fixtures/
    helpers.ts

  public/
  tmp/
```

## README Expectations

- Explain what the demo proves or teaches.
- Document how to run it locally.
- Point out the key Remix APIs or patterns being demonstrated.
- Keep code examples and imports aligned with repo guidance: use `remix` package exports where available.

## Validation

- Run `pnpm -C demos/<name> typecheck` when the demo defines a typecheck script.
- Run `pnpm -C demos/<name> test` when the demo defines tests.
- Smoke-test the demo server locally when behavior depends on live requests or browser interaction.
- Run `pnpm run lint` before finishing.
