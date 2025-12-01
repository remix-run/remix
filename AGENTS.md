# Remix 3 Development Guide

## Commands

- **Build**: `pnpm run build` (all packages) or `pnpm --filter @remix-run/<package> run build` (single package)
- **Test**: `pnpm test` (all packages) or `pnpm --filter @remix-run/<package> run test` (single package)
- **Single test file**: `node --disable-warning=ExperimentalWarning --test './packages/<package>/src/**/<filename>.test.ts'`
- **Typecheck**: `pnpm run typecheck` (all packages) or `pnpm --filter @remix-run/<package> run typecheck`
- **Lint**: `pnpm run lint` (check) or `pnpm run lint:fix` (auto-fix)
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

## Changelog Formatting

- Use `## Unreleased` as the heading for unreleased changes (not `## HEAD`)
- Scripts in `./scripts` are configured to replace `## Unreleased` with version and date on release
- **Only modify the `## Unreleased` section**: Older changelog entries represent a point in time when that release was made. Do not modify code examples or text in past releases, even if they reference outdated APIs.
- **BREAKING CHANGEs come first**: Within a release section, list all BREAKING CHANGE entries before any feature additions. This makes it easy for users to quickly identify what broke in a release.
