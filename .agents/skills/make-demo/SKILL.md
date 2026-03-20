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
- Treat each demo as its own pnpm workspace consumer. Give it a normal `package.json` with `remix` as a dependency when appropriate, and import from package exports such as `remix/component` instead of reaching back into `packages/` with relative imports.
- Keep any non-Remix dependency incidental to the runtime environment only. If a database driver, asset bundler, or type package is needed, it should support the demo rather than define its architecture.
- Demos should push Remix to its limits in a focused way. Prefer realistic edge cases, composition, streaming, middleware, routing, navigation, forms, or request-handling scenarios over toy examples.
- When demos use `remix/component`, prefer idiomatic Remix component patterns. Use normal JSX composition and built-in styling/mixin props such as `css={...}` or `mix={css(...)}` and `mix={[...]}` instead of dropping down to manual DOM mutation or ad hoc class management.
- When a demo uses `remix/component` JSX, configure that demo's `tsconfig.json` with `jsx: "react-jsx"`, `jsxImportSource: "remix/component"`, and `preserveSymlinks: true`. Do not add `paths` entries that point back into `packages/remix/src`. The goal is for TypeScript to resolve `remix` through the demo's own `node_modules` view, not through repo-relative source paths.
- For HTML responses rendered with `remix/component`, prefer a tiny local `render()` helper that calls `renderToStream(...)` and wraps it with `createHtmlResponse(...)` from `remix/response/html` instead of manually building HTML `Response` headers or wrapping the stream yourself.
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

When a demo is a real application, prefer a uniform Remix application layout instead of inventing a
new structure for each demo.

### Root layout

Use these root directories consistently:

- `app/` for runtime application code
- `data/` for database lifecycle files such as schema, setup, seeds, migrations, and local SQLite
  databases
- `test/` for cross-feature integration tests, fixtures, and test helpers
- `public/` for static files served as-is
- `tmp/` for runtime scratch files such as sessions, uploads, and caches

### App layout

Inside `app/`, organize code by responsibility:

- `controllers/` for all controller-owned features, with folders such as `controllers/home/`,
  `controllers/auth/`, or `controllers/account/`, each with a `controller.tsx` entrypoint and the
  UI it owns
- `controllers/ui/` for reusable cross-feature UI primitives used by those controllers
- `middleware/` for request-layer concerns such as auth, database injection, sessions, and other
  request lifecycle setup
- `integrations/` for third-party provider and API wiring
- `models/` for app-specific data shapes and domain-level utilities

Do not create generic `operations/` or `utils/` directories by default. Put code with the layer
that owns it. Split an integration into multiple modules only when it is large enough to justify
that complexity.

### Naming and ownership rules

- Keep controllers thin. They should read request context, call application logic, and return a
  response.
- Put each controller in its controller feature folder as `controller.tsx`. Do not split
  controller files across the app root and feature folders.
- If a component or helper is only used by one controller feature, keep it in that controller
  feature folder instead of `controllers/ui/`.
- Use `controllers/ui/` only for reusable UI primitives. Do not create a generic
  `app/components/` dumping ground.
- Do not create a generic `app/lib/` dumping ground.
- Avoid feature barrel files such as `index.ts`. Import feature modules directly.
- If a helper is shared only by controllers, keep it under `controllers/`.
- If a helper is part of request/session setup, keep it under `middleware/`.
- If a helper talks to an external system, keep it under `integrations/`.
- Put database schema and setup outside `app/` under `data/`.
- Co-locate unit tests with the models or other modules they cover.
- Keep app-wide request-flow tests under `test/feature/`, and keep shared test helpers under
  `test/`.

### Example layout

```text
demos/<name>/
  app/
    router.ts
    routes.ts

    controllers/
      render.tsx

      home/
        controller.tsx
        login-page.tsx
        external-auth-section.tsx

      auth/
        controller.tsx
        login-action.ts
        signup-actions.tsx
        resolve-external-auth.ts

      account/
        controller.tsx
        account-page.tsx

      ui/
        auth-card.tsx
        document.tsx
        form-field.tsx
        notice.tsx
        icons.tsx
        design-system.ts
        styles.ts

    middleware/
      auth.ts
      database.ts
      session.ts

    integrations/
      external-auth.ts

    models/
      auth-session.ts
      auth-session.test.ts
      password-hash.ts

  data/
    schema.ts
    setup.ts
    setup.test.ts
    migrations/

  test/
    feature/
      router.test.ts
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
