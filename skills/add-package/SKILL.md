---
name: add-package
description: Create or align a package in the Remix monorepo to match existing package conventions. Use when adding a brand new package under packages/, or when fixing an existing package's structure, test setup, TypeScript/build config, code style, and README layout to match the rest of Remix 3.
---

# Add Package

## Overview

Use this skill to scaffold and standardize packages so they look and behave like the existing `@remix-run/*` packages.
Follow this exactly when creating package files, public exports, tests, and docs.

## Workflow

1. Create the package directory and baseline files.

- Create `packages/<package-name>/`.
- Add:
  - `package.json`
  - `tsconfig.json`
  - `tsconfig.build.json`
  - `CHANGELOG.md`
  - `README.md`
  - `LICENSE`
  - `.changes/README.md`
  - `src/`
- For new packages, start `CHANGELOG.md` with `## Unreleased` as the first section to indicate changes are not released yet.

2. Set up `package.json` using monorepo conventions.

- Use:
  - `name`: `@remix-run/<package-name>`
  - `version` (for brand-new packages): `"0.0.0"`
  - `type`: `"module"`
  - `license`: `"MIT"`
  - `repository.directory`: `packages/<package-name>`
  - `homepage`: `https://github.com/remix-run/remix/tree/main/packages/<package-name>#readme`
- Include `files`:
  - `LICENSE`
  - `README.md`
  - `dist`
  - `src`
  - `!src/**/*.test.ts`
- Add standard scripts:
  - `build`: `tsgo -p tsconfig.build.json`
  - `clean`: `git clean -fdX`
  - `prepublishOnly`: `pnpm run build`
  - `test`: `node --disable-warning=ExperimentalWarning --test`
  - `typecheck`: `tsgo --noEmit`
- Use baseline dev dependencies:
  - `"@types/node": "catalog:"`
  - `"@typescript/native-preview": "catalog:"`
- Add `keywords` like existing packages (short, lowercase, feature-focused).

3. Define exports with `src` entry files only.

- In `exports`, map each public subpath to a dedicated file in `src`.
- Always include `./package.json`.
- Mirror each export in `publishConfig.exports` with `dist` output:
  - `types`: `./dist/<entry>.d.ts`
  - `default`: `./dist/<entry>.js`
- Rule: every export must have a `src` file that re-exports from `src/lib`.
  - Example: export `./foo` -> `src/foo.ts` -> `export { ... } from './lib/foo.ts'`

4. Add TypeScript config files with shared defaults.

Use this `tsconfig.json` pattern:

```json
{
  "compilerOptions": {
    "strict": true,
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "target": "ESNext",
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "verbatimModuleSyntax": true
  }
}
```

Use this `tsconfig.build.json` pattern:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

5. Implement source structure and test setup.

- Structure source as:
  - `src/<entry>.ts` for public entry points
  - `src/lib/*.ts` for implementation
  - `src/lib/*.test.ts` for tests (colocated with implementation)
- Tests use Node's built-in test runner:
  - `import * as assert from 'node:assert/strict'`
  - `import { describe, it } from 'node:test'`
- Keep tests IDE-friendly:
  - Do not generate tests with loops/conditionals inside `describe()`.

6. Follow monorepo code style rules while implementing.

- Use `import type { ... }` and `export type { ... }` for types.
- Include `.ts` extensions in relative imports.
- Prefer `let` for locals; use `const` only at module scope.
- Never use `var`.
- Prefer function declarations/expressions for normal functions.
- Use arrow functions for callbacks; use concise callbacks when returning a single expression.
- Use object method shorthand (`method() {}`) instead of arrow properties.
- Use native class fields and `#private` members.
- Avoid Node-specific APIs when Web APIs are available.

7. Write README in the same style and section order as existing packages.

- Start with:
  - `# <package-name>`
  - One short paragraph describing purpose.
- Typical section order:
  - `## Features`
  - `## Installation`
  - `## Usage`
  - Optional deep-dive sections (only if needed)
  - `## Related Packages` (if applicable)
  - `## License`
- Installation instructions must always include installing the `remix` package.
- If using the package requires a peer dependency, installation instructions must also include that peer dependency in the command.
- Preferred installation pattern:

```sh
npm i remix
```

- Example when a peer dependency is required:

```sh
npm i remix <peer-dependency>
```

- Usage examples must always import from `remix` package exports, not from `@remix-run/<package-name>` directly.

- License section format:
  - `See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)`

8. Do not manually update the generated `remix` package in PRs.

- `packages/remix` is generated automatically in CI.
- Do not manually edit `packages/remix/package.json` or `packages/remix/src/*` in new pull requests.
- Do not add `packages/remix/.changes/*` change files in new pull requests.
- If user asks for full surfacing, you can still update root `README.md` package list when applicable.

9. Validate before finishing.

- Run package checks:
  - `pnpm --filter @remix-run/<package-name> run typecheck`
  - `pnpm --filter @remix-run/<package-name> run test`
  - `pnpm --filter @remix-run/<package-name> run build`
- Run repo lint (required):
  - `pnpm run lint`
- Add or update a change file under `packages/<package-name>/.changes/` when requested by contribution workflow.
- For a brand-new package, the initial change file should use a `minor.` filename (for example, `minor.initial-release.md`) so the first release bumps `0.0.0` to `0.1.0`.
- Exception: do not add a change file under `packages/remix/.changes/`; `remix` package updates are CI-generated.

## Templates

Use this minimal `src/index.ts` style:

```ts
export { createThing, type ThingOptions } from './lib/thing.ts'
```

Use this minimal test style:

```ts
import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createThing } from './thing.ts'

describe('createThing', () => {
  it('returns expected value', () => {
    let result = createThing()
    assert.equal(result, 'ok')
  })
})
```
