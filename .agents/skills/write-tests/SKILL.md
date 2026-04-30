---
name: write-tests
description: Write, refactor, or review tests in the Remix repository. Use when adding or changing `.test.ts`/`.test.tsx` files, package test scripts, test fixtures, mocks, coverage tests, e2e tests, or package metadata for test-only dependencies.
---

# Write Tests

## Overview

Write tests that prove behavior with the smallest useful fixture surface. Use Remix's own
test/assert packages and `describe`/`it` style by default, keep package dependency graphs clean, and
validate with the narrowest reliable commands.

## Workflow

1. Read the nearest `package.json`, `tsconfig.json`, and existing sibling tests before choosing a runner or fixture style.
2. Identify whether the package can depend on `@remix-run/test`, or whether it is a dependency of `@remix-run/test` and must avoid a circular dependency.
3. Keep the test close to the behavior owner. Prefer local helpers and direct Web/Node primitives over importing higher-level workspace packages as fixtures.
4. Put test-only workspace packages in `devDependencies` with `workspace:^`; do not add them to runtime `dependencies`.
5. Run the package test and typecheck commands. Refresh `pnpm-lock.yaml` when package metadata changes.

## Runner Choice

- Write new and changed tests in `describe`/`it` style. When touching a file that uses top-level `test()`, convert the affected tests to `describe`/`it` and leave unrelated tests alone.
- Use `@remix-run/test` and `@remix-run/assert` by default for package tests.
- Use `node:test` and `node:assert/strict` only when testing a package that is a dependency of `@remix-run/test`, or when adding Remix test/assert as a dependency would create a circular dependency.
- Do not keep a `test:bun` script for `node:test` packages unless it has been validated. Bun's test runner does not automatically discover tests written with `node:test` imports.

Node test package script:

```json
"test": "node --disable-warning=ExperimentalWarning --test './src/**/*.test.ts'"
```

Node test imports:

```ts
import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
```

Remix test package script:

```json
"test": "remix-test"
```

Remix test imports:

```ts
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
```

## Test Structure

- Name `describe()` blocks after the public API or behavior owner, and name `it()` tests by observable behavior.
- Do not generate tests inside `describe()` with loops or conditionals; this breaks per-test IDE execution.
- Prefer a few explicit cases over dense table tests when the cases document distinct behavior.
- Keep async tests awaited all the way through. Avoid resolving promises before the behavior under test has completed.
- Use mocks sparingly and locally. Prefer the Remix test context mocks when using `@remix-run/test`; use `mock.method()`/`mock.fn()` from `node:test` only in node-runner exception packages.

## Fixtures

- Keep fixtures minimal and local to the test file unless they are reused across multiple files for the same behavior surface.
- Avoid importing higher-level workspace packages just to build a fixture. For example, a fetch-handler test can branch on `new URL(request.url).pathname` instead of depending on `@remix-run/fetch-router`.
- Prefer Web APIs and standards-aligned primitives when they express the fixture clearly.
- For e2e tests, serve the smallest app or handler that exercises the user-observable behavior under test.

## Assertions

- Use `@remix-run/assert` by default.
- Use `node:assert/strict` only in node-runner exception packages that cannot depend on `@remix-run/assert`/`@remix-run/test`.
- Assert public behavior and observable side effects. Avoid asserting private implementation structure unless the package's public contract is the structure.
- For error tests, assert the error shape/message that consumers can rely on.

## Dependency Hygiene

- Runtime code imports belong in `dependencies`.
- Test files, fixtures, and runner-only imports belong in `devDependencies`.
- Use `workspace:^` for workspace package dependencies unless the repo has an established reason for `workspace:*`.
- After changing package dependencies or scripts, run `pnpm i --lockfile-only --ignore-scripts` and then a frozen install check.
- Reassess workspace cycles when changing testing infrastructure: `pnpm i --frozen-lockfile --ignore-scripts` should not emit cyclic workspace dependency warnings.

## Validation

Use the narrowest meaningful commands:

```sh
pnpm --filter @remix-run/<package> run test
pnpm --filter @remix-run/<package> run typecheck
pnpm i --frozen-lockfile --ignore-scripts
```

For cross-package or shared test infrastructure changes, also consider:

```sh
pnpm run test:changed
pnpm run typecheck:changed
pnpm run lint
```
