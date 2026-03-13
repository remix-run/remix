---
name: write-api-docs
description: Write or audit public API docs for Remix packages. Use when adding or tightening JSDoc on exported functions, classes, interfaces, type aliases, or option objects.
---

# Write API Docs

## Overview

Use this skill when documenting public APIs in Remix packages.

The goal is to document the API users can actually import, not every helper in `src/lib`.
Work from the package exports outward, add concise JSDoc to the public declarations, and make sure the result passes the repo's ESLint JSDoc rules.

## Workflow

1. Identify the package's public exports.
2. Find the `src` entry files that back those exports.
3. Trace those entry files to the declarations they re-export from `src/lib`.
4. Add or tighten JSDoc on the public declarations only.
5. Run package typecheck if appropriate and always run `pnpm run lint`.

## How To Identify Public API

The source of truth is the package's `package.json`.

- Start with `package.json` `exports`.
- Each public export should map to a file directly under `src/`.
- Those `src/*.ts` entry files define the public surface by re-exporting symbols from `src/lib`.
- A declaration in `src/lib` is public only if it is re-exported by one of those public `src/*.ts` entry files.

Rules:

- Do not assume everything in `src/lib` is public.
- Do not document private helpers just because they are exported within `src/lib`.
- If a declaration is not reachable from a package export, it is internal unless the user explicitly asks otherwise.

## What To Document

For public API, add JSDoc to:

- exported functions
- exported classes
- exported interfaces
- exported type aliases
- exported public constants when they are part of the API shape

For public interfaces:

- add a JSDoc block on the interface itself
- add a property-level JSDoc block for every property on the interface, even when the name seems obvious

For public object-shaped type aliases:

- prefer an `interface` when you are introducing a new public object shape
- if an existing public type alias cannot reasonably become an interface, document the object shape as thoroughly as the syntax allows

For overloads:

- document the public overload signatures or the exported declaration in a way that makes the callable surface clear to users

## JSDoc Style For This Repo

Keep comments short, factual, and user-facing.

- Describe what the API does, not how the implementation works internally.
- Prefer one concise summary sentence, then short `@param` / `@returns` docs as needed.
- Do not put TypeScript types in JSDoc tags. ESLint forbids JSDoc type syntax here because the source of truth is the TypeScript signature.
- Keep parameter names in JSDoc exactly aligned with the function signature.
- Use `@returns` for non-void functions and include a real description.
- For `@param`, include descriptions and do not add a hyphen before the description.
- Specify `@param` default values in parenthesis at the end of the comment, do not use `@default` tags
- Include an `@example` code block when it helps to show a use-case or pattern. Skip `@example` for simple getters, trivial constructors, or APIs whose usage is self-evident.
- Use `{@link API}` to link to related Remix APIs when it adds value. Don't link every related API — use discretion to avoid noise.
- Use backticks for all other unlinked code references — identifiers, HTTP methods, special values.

Good:

```ts
/**
 * Creates an {@link AuthProvider} for direct credentials-based authentication.
 *
 * @param options Parsing and verification hooks for submitted credentials.
 * @returns A provider that can be passed to `login()`.
 */
export function createCredentialsAuthProvider(...) {}
```

Avoid:

```ts
/**
 * @param {CredentialsOptions} options - options
 * @returns {CredentialsProvider}
 */
```

## ESLint Expectations

The relevant rules live in [`eslint.config.js`](../../eslint.config.js).

For `packages/**/*.{ts,tsx}` (excluding tests), ESLint enforces JSDoc on callable declarations such as:

- function declarations
- function expressions
- arrow functions
- class declarations
- public methods

Important enforced details:

- `jsdoc/require-param`
- `jsdoc/require-param-name`
- `jsdoc/require-param-description`
- `jsdoc/require-returns`
- `jsdoc/require-returns-description`
- `jsdoc/no-types`
- `jsdoc/check-param-names`
- `jsdoc/check-types`
- `jsdoc/check-alignment`

Practical implication:

- if a public function takes parameters, document all of them
- if a public function returns a value, document the return value
- do not use JSDoc type annotations
- keep the block formatted cleanly enough to satisfy alignment checks

## Review Checklist

- Did you start from `package.json` exports instead of guessing from `src/lib`?
- Are all documented declarations actually reachable from a public `src/*.ts` entry file?
- Do all public functions and methods have JSDoc with `@param` and `@returns` where required?
- Do public interfaces and type aliases have a concise doc block explaining what they represent?
- Does every property on every public interface have its own property-level JSDoc block?
- Did you avoid documenting internal helpers that are not exported publicly?
- Did `pnpm run lint` pass?
