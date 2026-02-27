# Remix 3 Development Guide

## Commands

- **Build**: `pnpm run build` (all packages) or `pnpm --filter @remix-run/<package> run build` (single package)
- **Test**: `pnpm test` (all packages) or `pnpm --filter @remix-run/<package> run test` (single package)
- **Single test file**: `node --disable-warning=ExperimentalWarning --test './packages/<package>/src/**/<filename>.test.ts'`
- **Typecheck**: `pnpm run typecheck` (all packages) or `pnpm --filter @remix-run/<package> run typecheck`
- **Lint**: `pnpm run lint` (check) or `pnpm run lint:fix` (auto-fix)
- **Before finishing work**: Run `pnpm run lint` and resolve any lint errors before reporting completion.
- **Format**: `pnpm run format` (auto-fix) or `pnpm run format:check` (check only)
- **Clean**: `pnpm run clean` (git clean -fdX)

## Architecture

- **Monorepo**: pnpm workspace with packages in `packages/` directory
- **Key packages**: headers, fetch-proxy, fetch-router, file-storage, form-data-parser, lazy-file, multipart-parser, node-fetch-server, route-pattern, tar-parser
- **Package exports**: All `exports` in `package.json` have a dedicated file in `src` that defines the public API by re-exporting from within `src/lib`
- **Cross-package boundaries**: Avoid re-exporting APIs/types from other packages. Consumers should import from the owning package directly. Reuse shared concepts from sibling packages internally instead of creating bespoke duplicate implementations.
- **Philosophy**: Web standards-first, runtime-agnostic (Node.js, Bun, Deno, Cloudflare Workers). Use Web Streams API, Uint8Array, Web Crypto API, Blob/File instead of Node.js APIs
- **Tests run from source** (no build required), using Node.js test runner

## Code Style

- **Imports**: Always use `import type { X }` for types (separate from value imports); use `export type { X }` for type exports; include `.ts` extensions
- **One-off scripts**: Write one-off scripts in this repo as TypeScript and make them executable natively with modern Node.js (for example, executable `.ts` files)
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

## Changes and Releases

- **Adding changes**: Create `packages/*/.changes/[major|minor|patch].short-description.md` files. See [CONTRIBUTING.md](./CONTRIBUTING.md#adding-a-change-file) for details.
- **Updating changes**: If iterating on an unpublished change with a change file, update it in place rather than creating a new one.
- **Versioning**: Follow semver, but ensure you follow 0.x conventions where breaking changes can happen in minor releases:
  - For **v0.x packages**: Use "minor" for breaking changes and new features, "patch" for bug fixes. Never use "major" unless explicitly instructed. Change files for breaking changes in v0.x packages should start with `BREAKING CHANGE: ` so they are hoisted to the top.
  - For **v1.x+ packages**: Use standard semver - "major" for breaking changes, "minor" for new features, "patch" for bug fixes.
  - **Breaking changes are relative to main**: If you introduce a new API in a PR and then change it within the same PR before merging, that's not considered a breaking change.
  - _For the `remix` package only:_
    - **Prerelease mode**: An optional `.changes/config.json` file with a `prereleaseChannel` field (e.g. `"alpha"`, `"beta"`, `"rc"`) denotes that the package is in prerelease mode. The channel determines the version suffix, while the npm dist-tag is always `"next"`.
    - **Bumping prerelease versions**: You can use normal change files. These will bump the prerelease counter (e.g. `3.0.0-alpha.1` → `3.0.0-alpha.2`). Changelog entries still get proper Major/Minor/Patch sections, but otherwise the bump type is ignored and only the prerelease counter is bumped.
    - **Transitioning between prerelease channels** (e.g. `alpha` → `beta`): Update `prereleaseChannel` in `.changes/config.json` and add a change file. Version resets to new channel (e.g. `3.0.0-alpha.7` → `3.0.0-beta.0`). The bump type is for changelog categorization only—by convention, use `patch`.
    - **Graduating from prerelease to latest stable version**: Remove `prereleaseChannel` from `.changes/config.json` (or delete the file) and add a change file. The prerelease suffix will be stripped (e.g. `3.0.0-rc.7` → `3.0.0`). The bump type is for changelog categorization only—by convention, use `major` for a major release announcement.
- **Validating changes**: `pnpm changes:validate` checks that all change files follow the correct naming convention and format.
- **Previewing releases**: `pnpm changes:preview` shows which packages will be released, what the CHANGELOG will look like, and the commit message.
- **Automated releases**: When changes are pushed to `main`, the [release-pr workflow](/.github/workflows/release-pr.yaml) automatically opens/updates a "Release" PR. The [publish workflow](/.github/workflows/publish.yaml) runs on every push to `main` and publishes when no change files are present (i.e., after merging the Release PR).
- **Manual releases**: `pnpm changes:version` updates package.json, CHANGELOG.md, and creates a git commit. Push to `main` and the publish workflow will handle the rest (including tags and GitHub releases).
- **How publishing works**: The publish workflow checks for change files. If none exist, it runs `pnpm publish --recursive --report-summary`, reads the summary JSON to see what was published, then creates git tags and GitHub releases for each published package.
- **Test change/release code with preview scripts**: When modifying any change/release code, run `pnpm changes:preview` to test locally. For the release PR script, run `node ./scripts/release-pr.ts --preview`. For the publish script, run `node ./scripts/publish.ts --dry-run` to see what commands would be executed without actually publishing.

## Skills

A skill is a reusable local instruction set stored in a `SKILL.md` file.

### Available skills

- **supersede-pr**: Replace one GitHub PR with another and explicitly close the superseded PR (instead of relying on `Closes #...` keywords). (file: `./skills/supersede-pr/SKILL.md`)
- **make-pr**: Create GitHub pull requests with clear context, issue/feature bullets, and required usage examples for new or changed APIs. (file: `./skills/make-pr/SKILL.md`)
