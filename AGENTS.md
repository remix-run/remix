# Remix 3 Development Guide

## Commands

- **Build**: `pnpm run build` (all packages) or `pnpm --filter @remix-run/<package> run build` (single package)
- **Test**: `pnpm test` (all packages) or `pnpm --filter @remix-run/<package> run test` (single package)
- **Single test file**: `node --disable-warning=ExperimentalWarning --test './packages/<package>/src/**/<filename>.test.ts'`
- **Typecheck**: `pnpm run typecheck` (all packages) or `pnpm --filter @remix-run/<package> run typecheck`
- **Lint**: `pnpm run lint` (check) or `pnpm run lint:fix` (auto-fix)
- **Format**: `pnpm run format` (auto-fix) or `pnpm run format:check` (check only)
- **Clean**: `pnpm run clean` (git clean -fdX)

## Architecture

- **Monorepo**: pnpm workspace with packages in `packages/` directory
- **Key packages**: headers, fetch-proxy, fetch-router, file-storage, form-data-parser, lazy-file, multipart-parser, node-fetch-server, route-pattern, tar-parser
- **Package exports**: All `exports` in `package.json` have a dedicated file in `src` that defines the public API by re-exporting from within `src/lib`
- **Philosophy**: Web standards-first, runtime-agnostic (Node.js, Bun, Deno, Cloudflare Workers). Use Web Streams API, Uint8Array, Web Crypto API, Blob/File instead of Node.js APIs
- **Tests run from source** (no build required), using Node.js test runner

## Code Style

- **Imports**: Always use `import type { X }` for types (separate from value imports); use `export type { X }` for type exports; include `.ts` extensions
- **Variables**: Prefer `let` for locals, `const` only at module scope; never use `var`
- **Functions**: Use regular function declarations/expressions by default. Only use arrow functions as callbacks (e.g., route handlers, array methods) where preserving lexical `this` is beneficial or the syntax is more concise
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

## Changes and Releases

- **Adding changes**: Create `packages/*/.changes/[major|minor|patch].short-description.md` files. See [CONTRIBUTING.md](./CONTRIBUTING.md#adding-a-change-file) for details.
- **Updating changes**: If iterating on an unpublished change with a change file, update it in place rather than creating a new one.
- **Versioning**: Follow semver, but ensure you follow 0.x conventions where breaking changes can happen in minor releases:
  - For **v0.x packages**: Use "minor" for breaking changes and new features, "patch" for bug fixes. Never use "major" unless explicitly instructed. Change files for breaking changes in v0.x packages should start with `BREAKING CHANGE: ` so they are hoisted to the top.
  - For **v1.x+ packages**: Use standard semver - "major" for breaking changes, "minor" for new features, "patch" for bug fixes.
  - **Breaking changes are relative to main**: If you introduce a new API in a PR and then change it within the same PR before merging, that's not considered a breaking change.
- **Validating changes**: `pnpm changes:validate` checks that all change files follow the correct naming convention and format.
- **Previewing releases**: `pnpm changes:preview` shows which packages will be released, what the CHANGELOG will look like, the commit message and tags.
- **Versioning releases**: `pnpm changes:version` updates package.json, CHANGELOG.md, creates a git commit and tags. Don't run this unless explicitly instructed to do so. We don't want accidental releases during development.
- **Test change/release code with preview scripts**: When modifying any change/release code, run `pnpm changes:preview` and `pnpm create-github-release:preview` to test locally.
