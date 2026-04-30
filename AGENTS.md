# Remix Agent Guide

This repository includes the source code for Remix 3, a web framework for building modern web applications using TypeScript/JavaScript and web standard APIs.

## Repo Shape

- **Monorepo**: pnpm workspace with most product code under `packages/`
- **Public API layout**: every `exports` entry in `package.json` should map to a dedicated top-level `src/*.ts` file
- **Implementation layout**: `src/lib` is implementation-only; do not add barrel re-exports or thin pass-through wrappers inside `src/lib`
- **Cross-package boundaries**: do not re-export APIs or types from another package; import from the owning package directly
- **Platform stance**: prefer Web APIs and standards-aligned primitives over Node-specific APIs whenever possible

## Default Development Loop

- **Fast local loop**: `pnpm run lint`, `pnpm run test:changed`, `pnpm run typecheck:changed`
- **Full CI-style validation**: `pnpm test` and `pnpm run typecheck`
- **When to use full runs locally**: broad cross-workspace changes, shared root config changes, release/publish flow changes, or anything that could affect the whole repo
- **Single package commands**: `pnpm --filter @remix-run/<package> run test`, `pnpm --filter @remix-run/<package> run typecheck`, `pnpm --filter @remix-run/<package> run build`
- **Single test file**: `cd packages/<package> && pnpm test src/**/<filename>.test.ts`
- **Lint**: `pnpm run lint` or `pnpm run lint:fix`
- **Format**: `pnpm run format` or `pnpm run format:check`

The changed-workspace commands default to diffing against `origin/main` and include uncommitted working tree changes when `head-ref` is `HEAD`.

## Code Style

- **Imports**: use `import type { X }` and `export type { X }`; include `.ts` extensions
- **Variables**: use `let` for locals, `const` for module scope, never `var`
- **Functions**: use regular functions by default; use arrow functions for callbacks; use concise arrow bodies when they only return an expression
- **Object methods**: use shorthand method syntax
- **Classes**: omit TS accessibility modifiers; use native fields and `#private`
- **Generics**: use descriptive lowercase names like `source`, `pattern`, or `method`
- **Comments**: add non-JSDoc comments only when behavior is surprising or non-obvious
- **Formatting**: Prettier with `printWidth: 100`, no semicolons, single quotes, spaces not tabs

## Tests And Docs

- **Tests run from source**: no build step required
- **Test structure**: do not generate tests inside `describe()` with loops or conditionals; it breaks per-test IDE execution
- **Test guidance**: use the `write-tests` skill when adding, refactoring, or reviewing tests, fixtures, test scripts, or test-only dependencies
- **Docs and examples**: if you change a public API, update the related docs, JSDoc, README examples, and tests in the same change
- **README/install conventions**: use `npm i remix` in install snippets and import from `remix`, not `@remix-run/*`

## Release Notes

- If a change affects published packages, add or update the appropriate change file.
- If you modify release or publish flow code, validate it with the preview or dry-run scripts before finishing.

## Repo Skills

For work on this repository itself, use the skills in `.agents/skills/`:

- `add-package` at `.agents/skills/add-package/SKILL.md`: Create or align a package under `packages/` with repo conventions.
- `expert-typescript-programmer` at `.agents/skills/expert-typescript-programmer/SKILL.md`: Write, refactor, or review TypeScript with strict, precise, maintainable types.
- `write-tests` at `.agents/skills/write-tests/SKILL.md`: Write, refactor, or review tests with repo runner, fixture, assertion, dependency, and validation conventions.
- `make-change-file` at `.agents/skills/make-change-file/SKILL.md`: Create or update package change files under `packages/*/.changes`.
- `make-demo` at `.agents/skills/make-demo/SKILL.md`: Create or revise demos in this repository with production-quality Remix patterns.
- `make-pr` at `.agents/skills/make-pr/SKILL.md`: Prepare and open clear, reviewer-friendly pull requests.
- `publish-placeholder-package` at `.agents/skills/publish-placeholder-package/SKILL.md`: Publish a `0.0.0` placeholder package to reserve an npm name.
- `review-pr` at `.agents/skills/review-pr/SKILL.md`: Review Remix pull requests from a local checkout.
- `supersede-pr` at `.agents/skills/supersede-pr/SKILL.md`: Replace one pull request with another and close the superseded PR safely.
- `update-pr` at `.agents/skills/update-pr/SKILL.md`: Rewrite an existing pull request title and body to match the current diff.
- `write-api-docs` at `.agents/skills/write-api-docs/SKILL.md`: Write or tighten JSDoc for exported public APIs.
- `write-readme` at `.agents/skills/write-readme/SKILL.md`: Draft or revise package READMEs in the repo's style.

## App And Demo Skills

For working on Remix code in demos or writing Remix app code, use the skills in `skills/`:

- `remix` at `skills/remix/SKILL.md`: Build, review, and refactor Remix apps end to end, including project layout, routes, controllers, middleware, validation, data access, auth, sessions, uploads, UI, hydration, navigation, animations, and tests.
