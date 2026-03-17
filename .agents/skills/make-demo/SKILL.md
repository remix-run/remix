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
- Keep any non-Remix dependency incidental to the runtime environment only. If a database driver, asset bundler, or type package is needed, it should support the demo rather than define its architecture.
- Demos should push Remix to its limits in a focused way. Prefer realistic edge cases, composition, streaming, middleware, routing, navigation, forms, or request-handling scenarios over toy examples.
- When demos use `remix/component`, prefer idiomatic Remix component patterns. Use normal JSX composition and built-in styling/mixin props such as `css={...}` or `mix={css(...)}`
  and `mix={[...]}` instead of dropping down to manual DOM mutation or ad hoc class management.
- Demo code must have good hygiene. Use clear names, small focused modules, explicit control flow, and accessible markup. Avoid hacks, dead code, unexplained shortcuts, or patterns that would be poor examples for users to copy.
- Make the demo teach good patterns. Assume readers and future agents will study it as an example of how Remix code should be written in this repository.
- All demo servers should use port `44100`.
- Demo servers should handle `SIGINT` and `SIGTERM` cleanly by closing the server and exiting.

## Typical Structure

Use only the files the scenario needs, but prefer this shape:

- `demos/<name>/package.json`
- `demos/<name>/server.ts`
- `demos/<name>/README.md`
- `demos/<name>/app/`
- `demos/<name>/public/` when serving built assets or other static files

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
