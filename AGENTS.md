# Remix 3 Development Guide

## Commands

- **Build**: `pnpm run build` (all packages) or `pnpm --filter @remix-run/<package> run build` (single package)
- **Test**: `pnpm test` (all packages) or `pnpm --filter @remix-run/<package> run test` (single package)
- **Single test file**: `node --test './packages/<package>/src/**/<filename>.test.ts'`
- **Typecheck**: `pnpm run typecheck` (all packages) or `pnpm --filter @remix-run/<package> run typecheck`
- **Lint**: `pnpm run lint` (check) or `pnpm run lint:fix` (auto-fix)
- **Before finishing work**: Run `pnpm run lint` and resolve any lint errors before reporting completion.
- **Format**: `pnpm run format` (auto-fix) or `pnpm run format:check` (check only)
- **Clean**: `pnpm run clean` (git clean -fdX)

## Architecture

- **Monorepo**: pnpm workspace with packages in `packages/` directory
- **Key packages**: headers, fetch-proxy, fetch-router, file-storage, form-data-parser, lazy-file, multipart-parser, node-fetch-server, route-pattern, tar-parser
- **Package exports**: All `exports` in `package.json` have a dedicated file in `src` that defines the public API by re-exporting from within `src/lib`
- **Lib module boundaries**: Files in `src/lib` are implementation files. Do not add barrel-style re-exports or thin pass-through wrapper APIs between `src/lib` files. Re-exporting belongs only in top-level `src` barrel files that map to package exports.
- **Cross-package boundaries**: Avoid re-exporting APIs/types from other packages. Consumers should import from the owning package directly. Reuse shared concepts from sibling packages internally instead of creating bespoke duplicate implementations.
- **Documentation imports/install**: In package READMEs, documentation, and pull request code examples, installation instructions should always include `npm i remix`, usage examples should import from `remix` package exports (not `@remix-run/*`), and any required peer dependency should be included in the installation command.
- **Philosophy**: Web standards-first, runtime-agnostic (Node.js, Bun, Deno, Cloudflare Workers). Use Web Streams API, Uint8Array, Web Crypto API, Blob/File instead of Node.js APIs
- **Tests run from source** (no build required), using Node.js test runner

## Code Style

- **Imports**: Always use `import type { X }` for types (separate from value imports); use `export type { X }` for type exports; include `.ts` extensions
- **One-off scripts**: Write one-off scripts in this repo as TypeScript and make them executable natively with modern Node.js (for example, executable `.ts` files)
- **Node runtime assumption**: Assume a modern Node.js runtime that supports running TypeScript files natively; prefer `node path/to/script.ts` in examples and instructions.
- **Variables**: Prefer `let` for locals, `const` only at module scope; never use `var`
- **Functions**: Use regular function declarations/expressions by default. For callback-based APIs (array methods, Promise callbacks, test callbacks, transaction callbacks, etc.), prefer arrow functions over `function` expressions. When an arrow callback only returns a single expression, use a concise body (`value => expression`) instead of braces/`return`
- **Object methods**: When defining functions in object literals, use shorthand method syntax (`{ method() {} }`) instead of arrow functions (`{ method: () => {} }`)
- **Classes**: Use native fields (omit `public`), `#private` for private members (no TypeScript accessibility modifiers)
- **Formatting**: Prettier (printWidth: 100, no semicolons, single quotes, spaces not tabs)
- **TypeScript**: Strict mode, ESNext target, ES2022 modules, bundler resolution, verbatimModuleSyntax
- **Generics**: Use descriptive lowercase names for type parameters (e.g., `source`, `method`, `pattern`) instead of single uppercase letters like `T`, `P`, or `K`
- **Comments**: Only add non-JSDoc comments when the code is doing something surprising or non-obvious

## Test Structure

- **No loops or conditionals in test suites**: Do not use `for` loops or conditional statements (`if`, `switch`, etc.) to generate test cases within `describe()` blocks. This breaks the Node.js test runner's ability to run individual tests via IDE features (like clicking test icons in the sidebar).

## Demos

- All demo servers should use port **44100** for consistency across the monorepo
- **Accessible navigation**: Always use proper `<a>` elements for navigation links. Never use JavaScript `onclick` handlers on non-interactive elements like `<tr>`, `<div>`, or `<span>` for navigation. Links should be keyboard accessible and work with screen readers.
- **Clean shutdown**: Demo servers should handle `SIGINT` and `SIGTERM` signals to exit cleanly when Ctrl+C is pressed. Close the server and call `process.exit(0)`.

## Documentation

- API documentation is handled by scripts in the docs/ directory
- We use `typedoc` to process the source code, and then generate markdown files from the typedoc output
- Markdown API documentation files be generated via `pnpm run docs` in the docs/ directory

## Changes and Releases

- **Automated releases**: When changes are pushed to `main`, the [release-pr workflow](/.github/workflows/release-pr.yaml) automatically opens/updates a "Release" PR. The [publish workflow](/.github/workflows/publish.yaml) runs on every push to `main` and publishes when no change files are present (i.e., after merging the Release PR).
- **Manual releases**: `pnpm changes:version` updates package.json, CHANGELOG.md, and creates a git commit. Push to `main` and the publish workflow will handle the rest (including tags and GitHub releases).
- **How publishing works**: The publish workflow checks for change files. If none exist, it runs `pnpm publish --recursive --report-summary`, reads the summary JSON to see what was published, then creates git tags and GitHub releases for each published package.
- **Test change/release code with preview scripts**: When modifying any change/release code, run `pnpm changes:preview` to test locally. For the release PR script, run `node ./scripts/release-pr.ts --preview`. For the publish script, run `node ./scripts/publish.ts --dry-run` to see what commands would be executed without actually publishing.

## Skills

A skill is a reusable local instruction set stored in a `SKILL.md` file.

This repo has two different skill directories with different purposes:

- `./skills/` contains skills for creating Remix applications and working with Remix itself as an app framework or consumer library.
- `./.agents/skills/` contains skills for working on the packages, docs, demos, release flow, and other implementation details inside this repository.

When deciding which skill to use, check both sections below and pick the set that matches the task.

### Skills for working in this repository

- **add-package**: Create or align a package in the Remix monorepo to match existing package conventions. Use when adding a brand new package under packages/, or when fixing an existing package's structure, test setup, TypeScript/build config, code style, and README layout to match the rest of Remix 3. (file: `./.agents/skills/add-package/SKILL.md`)
- **make-change-file**: Create or update package change files using Remix repo conventions, deterministic naming, and release-note style. (file: `./.agents/skills/make-change-file/SKILL.md`)
- **make-demo**: Create or revise demos in the Remix repository so they stay focused on Remix packages, strong code hygiene, and production-quality patterns. (file: `./.agents/skills/make-demo/SKILL.md`)
- **make-pr**: Create GitHub pull requests with clear context, issue/feature bullets, and required usage examples for new or changed APIs. (file: `./.agents/skills/make-pr/SKILL.md`)
- **publish-placeholder-package**: Publish a minimal npm package at `0.0.0` to reserve the name and enable npm OIDC setup before CI-based publishing. (file: `./.agents/skills/publish-placeholder-package/SKILL.md`)
- **supersede-pr**: Replace one GitHub PR with another and explicitly close the superseded PR (instead of relying on `Closes #...` keywords). (file: `./.agents/skills/supersede-pr/SKILL.md`)
- **update-pr**: Rewrite GitHub PR titles and descriptions from scratch so they match the PR as it exists now, and always review the title when updating the body. (file: `./.agents/skills/update-pr/SKILL.md`)
- **write-api-docs**: Write or audit public API docs for Remix packages. Use when adding or tightening JSDoc on exported functions, classes, interfaces, type aliases, or option objects. (file: `./.agents/skills/write-api-docs/SKILL.md`)
- **write-readme**: Write or rewrite Remix package READMEs using this repo's structure, installation conventions, production-style examples, and section ordering. (file: `./.agents/skills/write-readme/SKILL.md`)

### Skills for building Remix applications

- **remix-project-layout**: Describe the ideal layout of a Remix application, including canonical directories, route ownership, naming conventions, and file locations on disk. Use when defining, reviewing, or bootstrapping an app layout; run the bundled TypeScript script when asked to scaffold it. (file: `./skills/remix-project-layout/SKILL.md`)
- **remix-ui**: Build the UI of a Remix app. Use when creating pages, layouts, client entries, interactions, stateful UI, navigation, hydration, styling, animations, reusable mixins, or UI tests. (file: `./skills/remix-ui/SKILL.md`)
