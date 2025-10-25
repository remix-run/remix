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
- **Philosophy**: Web standards-first, runtime-agnostic (Node.js, Bun, Deno, Cloudflare Workers). Use Web Streams API, Uint8Array, Web Crypto API, Blob/File instead of Node.js APIs
- **Tests run from source** (no build required), using Node.js test runner

## Code Style
- **Imports**: Always use `import type { X }` for types (separate from value imports); use `export type { X }` for type exports; include `.ts` extensions
- **Variables**: Prefer `let` for locals, `const` only at module scope; never use `var`
- **Classes**: Use native fields (omit `public`), `#private` for private members (no TypeScript accessibility modifiers)
- **Formatting**: Prettier (printWidth: 100, no semicolons, single quotes, spaces not tabs)
- **TypeScript**: Strict mode, ESNext target, ES2022 modules, bundler resolution, verbatimModuleSyntax

## Changelog Formatting
- Use `## Unreleased` as the heading for unreleased changes (not `## HEAD`)
- Scripts in `./scripts` are configured to replace `## Unreleased` with version and date on release
