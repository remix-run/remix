# Asset Imports and Asset File Handling

## Background: The Current System

The `assets` package is our "unbundler" — a build tool that processes source files one-to-one (1 input → 1 output) using esbuild as a per-file transformer and module resolver, without bundling them together. Each source file gets one output file; the module graph is preserved. This is distinct from how most people use esbuild (as a bundler), and it's important context for understanding the build section below.

### Scripts and file assets

The `assets` package differentiates between two kinds of assets:

**Scripts** are TypeScript/JavaScript entry points — files that are compiled by the unbundler, with their full transitive module graph discovered and tracked. A typical app has one or more script entries:

```ts
scripts: ['app/entry.tsx']
```

Each script entry gets its own compiled output file. The module graph is traversed to determine all transitive static imports, which are used to generate `<link rel="modulepreload">` tags for optimal loading performance.

**File assets** are non-JS files (images, fonts, etc.) matched by glob patterns and optionally transformed into multiple **variants** — different representations of the same source file for different use cases. Variants are configured with transformation functions:

```ts
import { defineAssetsSource } from '@remix-run/assets'
import sharp from 'sharp'

export const source = defineAssetsSource({
  scripts: ['app/entry.tsx'],
  files: [
    {
      include: 'app/images/**/*.png',
      variants: {
        thumbnail: (data) => ({
          data: sharp(data).resize({ width: 120 }).jpeg({ quality: 55 }).toBuffer(),
          ext: 'jpg',
        }),
        card: (data) => ({
          data: sharp(data).resize({ width: 280 }).jpeg({ quality: 62 }).toBuffer(),
          ext: 'jpg',
        }),
        hero: (data) => ({
          data: sharp(data).resize({ width: 560 }).jpeg({ quality: 72 }).toBuffer(),
          ext: 'jpg',
        }),
      },
      defaultVariant: 'card',
    },
  ],
})
```

Each variant produces a separate output file with its own content hash. The `defaultVariant` identifies the primary representation when no specific variant is requested. File assets without variants (e.g., a plain font or a favicon) are also supported — they're matched and tracked but passed through without transformation.

### The current resolution API

> **Naming note:** `context.assets.resolve()` was previously called `context.assets.get()`. It was renamed to `resolve()` for consistency across all `assets`-related packages — the concept is resolving asset paths, and "get" was ambiguous (a getter? getting what?). The rename establishes a single consistent noun ("resolver") and verb ("resolve") throughout.

The current asset resolution API has two sides:

**Development** (`dev-assets-middleware`): The `createDevAssets()` function sets up `context.assets.resolve()` on the request context. Calling it returns `{ href, preloads }` where `href` is a `/__@assets/...` URL pointing to the source file on disk, served and transformed on-the-fly by the dev handler. Scripts get `href: '/__@assets/app/entry.tsx'`. File assets (images, etc.) get `href: '/__@assets/app/images/logo.png?@thumbnail'`. The middleware is intentionally lazy — it only processes files when the browser actually requests them.

**Production** (`assets-middleware`): The `assets()` middleware reads a pre-built manifest JSON and sets `context.assets.resolve()` to return hashed output URLs like `/assets/app/entry-ABC123.js` and their transitive preload arrays.

**The `getAssets()` helper** (seen in the bookstore demo): Because `context.assets` is set per-request by middleware, consumers can access it anywhere in server-side request handling via Node's `AsyncLocalStorage` API (`remix/async-context-middleware`). The bookstore exports `getAssets()` from `app/utils/context.ts` as a convenience wrapper around `getContext().assets`.

---

## Problem

The current `resolveAsset()` / `context.assets.resolve()` API has three significant drawbacks:

### 1. No static guarantees

There's no compile-time error if a requested asset doesn't exist. The nullable return type (`AssetEntry | null`) forces constant null-checks — you either throw a runtime error or handle a missing case:

```ts
// Null checks everywhere, runtime errors
let logo = assets.resolve('app/images/logo.png')
if (!logo) return new Response('Logo not found', { status: 500 })
// logo.href is now safe to use
```

There's a further complication: in development, `context.assets.resolve()` is backed by the dev middleware, which constructs a URL without consulting a manifest due to its lazy nature. **The null path is never triggered in dev.** Only a production build — where the full assets manifest is known — will return null for a missing or renamed asset. This means the null-guard code you write is effectively dead code during development. The dev/prod gap is invisible, and code that looks correct in development silently fails in production.

> **Agent impact:** When an LLM renames or deletes an asset file, it has no static signal that `context.assets.resolve('app/images/old-name.png')` call sites elsewhere in the codebase also need updating. The string argument is opaque — no type checker or language server cross-references it to the source file. Worse, if the agent verifies its changes by running the dev server, everything will appear to work — the dev middleware is forgiving by design and returns valid-looking URLs even for assets that no longer exist. The breakage only surfaces in a production build, well outside the agent's normal feedback loop. With static imports, TypeScript immediately flags every stale reference at the import site — giving the agent precise, actionable feedback before any code runs.

It's worth calling out that these problems are new to developers accustomed to bundlers like webpack and Vite where you can import assets to get their URLs:

```ts
import imageUrl from './images/logo.png?url'
```

This gives them static type checking, compile-time errors for missing assets, and a URL that works anywhere — no null checks, no potential for runtime errors with missing assets, no server-side resolution, no threading values through props, no thinking about asset manifests. These are real, meaningful benefits that developers have come to rely on.

But this comes at a massive cost: **the code is no longer standard JavaScript or TypeScript.** Constructs like `import imageUrl from './image.png?url'` are not something `node` can execute. It's not something TypeScript understands natively. It only works because the bundler intercepts and transforms it in memory — making your source code a dialect that only runs inside that specific tool's pipeline. Your test runner needs matching transform configuration, like Vitest using your Vite config, or Jest with its transformers. Every tool in your chain must be taught about these imports. When you want to use a different tool, or run code outside the bundler, or debug something at the Node.js level, you can't — your source code has become a bundler-specific language dressed up as JavaScript. This is exactly the world of complexity we are trying to avoid in Remix, which is why we haven't explored this sort of approach.

### 2. Server-only; breaks on the client

`context.assets.resolve()` is only available on the server. Any component that might run on the client can't directly access asset URLs — paths must be resolved server-side and threaded down as props. The `getAssets()` helper from AsyncLocalStorage only works on the server too. There's no static guarantee that a component using `getAssets()` will never run on the client. These bugs surface at runtime, not compile time. The DX degrades the moment you want to share component code between server and client.

> **Agent impact:** An agent writing a reusable component has no static signal that `getAssets()` — or any function that transitively calls it — will throw when that component is used in a `clientEntry()` hydration context. There's no type-level distinction between "server-only" and "isomorphic" code. The failure surfaces at runtime during development, and the error may not clearly identify the `getAssets()` call as the root cause. With static imports, asset URLs are plain string constants that work identically in any context — the agent doesn't need to reason about execution environment at all.

### 3. All-or-nothing manifest

To ever support client-side asset resolution via `resolve()`, you'd need to ship the entire manifest to the browser. There's no way to code-split it or load only what you need. With static imports, each import is an independent module — only what's imported is downloaded on the client.

---

## Core Design Constraint: No Bundler Language

Before describing the solution, this constraint must be understood, as it drives all the key decisions:

> **We must not invent a custom language or require a special runtime transform to run user code.**

Tools like webpack and Vite let you write `import logo from './logo.png'` — importing a non-JS file as if it were a module — but this only works because the bundler transforms it. The resulting code is not real JavaScript; it's "webpackscript" or "vitescript". You can't run it with `node` directly. You can't run it in tests without matching transform config. Your test runner needs to match your bundler's transform configuration. The languages diverge.

**We refuse this tradeoff.** Our goal is that user code is real TypeScript that runs with `node --import tsx/esm` (or equivalent) without any custom processing. The asset import approach achieves this because the generated files are real TypeScript files containing string constants — nothing special is happening at the language level.

---

## Solution: Generated Asset Files

Asset URLs are embedded in real TypeScript files and statically imported. The files are generated by our tooling (codegen), but the imports themselves are standard TypeScript that any tool understands.

```ts
import entryAsset from '#assets/app/entry.tsx'
import bbqAsset from '#assets/app/images/books/bbq-1.png'
import logoAsset from '#assets/app/images/logo.png'
```

Then access the values as properties:

```ts
logoAsset.href // plain URL (no variants)
bbqAsset.href // default variant URL (if defaultVariant is set)
bbqAsset.variants.thumbnail.href // specific variant URL
bbqAsset.variants.card.href
entryAsset.href // script URL
entryAsset.preloads // all transitive static import URLs
```

`#assets/...` is a Node.js subpath import, backed by `package.json#imports`, that resolves to generated `.ts` files. The `#`-prefixed namespace is a Node.js convention for internal package imports and is natively supported by Node.js and TypeScript. The `*` in the pattern can match path separators (e.g., `#assets/app/images/logo.png` matches `"#assets/*"` with `*` = `app/images/logo.png`).

### What this solves

- **Static guarantee**: If `app/images/logo.png` doesn't exist, the `.placeholder.ts` file won't be generated, and the import fails at compile time (TS can't find the module). No null checks needed. For agents, this means a failing type check is a precise, actionable signal: re-run codegen, or the referenced file genuinely doesn't exist and the agent needs to reconsider its approach — either way, the feedback is immediate and unambiguous.
- **Works everywhere**: Asset URLs are plain string constants. They work identically in server code, client code, shared components, and tests — no `getAssets()`, no AsyncLocalStorage, no execution-environment reasoning required. Agents can write asset-referencing code without needing to track whether a given call site will ever run on the client or in a unit test.
- **Fine-grained loading**: Each asset is a separate module. Only imported assets contribute to targeted manifest payloads.
- **No runtime overhead**: In production, file asset `.build.ts` files compile to tiny `.js` modules (a handful of string exports) that the browser loads as normal module requests — visible in the Network tab, cacheable, no manifest to load, no resolution function to call.

---

## File Structure

### Two files per asset

For each source asset, two files are generated:

```
.assets/
  app/
    entry.tsx.placeholder.ts   ← placeholder URLs — checked in to source control
    entry.tsx.build.ts         ← production URLs — gitignored, generated by build
    images/
      logo.png.placeholder.ts
      logo.png.build.ts
      books/
        bbq-1.png.placeholder.ts
        bbq-1.png.build.ts
```

`.gitignore`:

```
.assets/**/*.build.ts
```

The `.assets/` directory itself is NOT gitignored — only the `.build.ts` files within it.

### Why "placeholder" not "dev"

An earlier iteration called these `.dev.ts` files. The name was renamed to `.placeholder.ts` for two reasons:

1. **Conceptual accuracy**: These files are checked into source control and used by TypeScript type checking — calling them "dev" understates and misdescribes their purpose. They are **typed stubs** that define the shape of an asset (`href`, `preloads`, `variants`) and hold placeholder URLs for dev, tests, and build-time traversal. The word "placeholder" accurately names this role in all contexts.
2. **Build-time usage**: The build tool uses `.placeholder.ts` files during module graph traversal (with the `placeholder` condition). Calling files that are loaded during a production build "dev files" is actively misleading.

### Why two separate files, not one index file with a runtime branch

An earlier approach considered generating an index file that branched at runtime:

```ts
// Rejected approach
const isDev = process.env.NODE_ENV === 'development'
import default_placeholder from './.assets/logo.png.placeholder.ts'
import default_build from './.assets/logo.png.build.ts'
export default isDev ? default_placeholder : default_build
```

This was rejected for two reasons:

1. Both placeholder and build URL strings would be included in the browser bundle, unless the bundler can statically eliminate dead code on `process.env.NODE_ENV`. Even when that works, it's indirect.
2. It's noisier — an extra file per asset that only exists to proxy the other two.

Instead, we use Node.js import conditions to select the correct file at resolution time, with no runtime branching and no extra files.

### Output directory

Default: `.assets/` (configurable via `codegenDir` option).

> **Note:** The dev file transform cache previously defaulted to `./.assets/files-cache`. It was renamed to `.assets-cache` to free up `.assets/` for the generated type files. Since this package had not shipped and had no external consumers, this was a free change.

The `filesCache` option default was changed from `'./.assets/files-cache'` to `'./.assets-cache'`.

---

## Generated File Format

### Placeholder files (checked in)

Placeholder URLs use the `/__@assets/` prefix — a unified namespace for all assets, scripts and files alike. This replaces both the old bare script paths (`/app/entry.tsx`) and the old file asset paths (`/__@files/...`).

The `/__@assets/` prefix:

- Is unambiguous — nobody writes this by hand
- Survives minification (it's a string value, not a comment)
- Makes asset requests visually distinct in the browser network tab
- Prevents accidentally hardcoded placeholder paths that silently break in production
- Works as a reliable marker for `substituteAssetPlaceholders` to find and replace

Placeholder URLs are derived purely from the source path — they don't depend on file contents, variant processing, or build output. This is what makes them safe to check in: they never go stale due to content changes. The dev handler serves them on-the-fly via the `/__@assets/` route.

Generated files use a **default export** of a named const object (not named exports), and include `as const` on build files for precise literal types. The object's variable name is derived from the source filename (e.g., `bbq-1.png` → `bbq1PngAsset`).

**File asset, with variants and `defaultVariant: 'card'`:**

```ts
// @generated by remix/assets — do not edit manually
// source: app/images/books/bbq-1.png
const bbq1PngAsset = {
  href: '/__@assets/app/images/books/bbq-1.png?@card',
  variants: {
    thumbnail: { href: '/__@assets/app/images/books/bbq-1.png?@thumbnail' },
    card: { href: '/__@assets/app/images/books/bbq-1.png?@card' },
    hero: { href: '/__@assets/app/images/books/bbq-1.png?@hero' },
  },
}
export default bbq1PngAsset
```

`href` at the top level is the `defaultVariant` URL. When a file rule has variants but no `defaultVariant`, there is no top-level `href` — only `variants`. The `variants` object always contains an entry for every variant name from the `files` config. (For file assets with no variants at all, only `href` is present.)

**File asset, without variants:**

```ts
// @generated by remix/assets — do not edit manually
// source: app/images/logo.png
const logoPngAsset = {
  href: '/__@assets/app/images/logo.png',
}
export default logoPngAsset
```

**Script entry:**

```ts
// @generated by remix/assets — do not edit manually
// source: app/entry.tsx
const entryTsxAsset = {
  href: '/__@assets/app/entry.tsx',
  preloads: ['/__@assets/app/entry.tsx#preloads'],
}
export default entryTsxAsset
```

Script placeholder `preloads` is always `['/__@assets/<sourcePath>#preloads']` — a single-element array with a `#preloads` fragment. This is a **1:N expansion marker**: when `substituteAssetPlaceholders` (or the internal build) encounters it, it replaces the entire array with the full transitive dependency list derived from the manifest. The `#preloads` fragment is never sent to the server (browsers strip fragments from requests), so the dev handler is unaffected.

### Build files (gitignored)

Generated by the build step after hashing is complete. Build files use `as const` for precise literal types.

**File asset, with variants:**

```ts
// @generated by remix/assets — do not edit manually
// source: app/images/books/bbq-1.png
const bbq1PngAsset = {
  href: '/assets/app/images/books/bbq-1-@card-ABC123.jpg',
  variants: {
    thumbnail: { href: '/assets/app/images/books/bbq-1-@thumbnail-XYZ789.jpg' },
    card: { href: '/assets/app/images/books/bbq-1-@card-ABC123.jpg' },
    hero: { href: '/assets/app/images/books/bbq-1-@hero-DEF456.jpg' },
  },
} as const
export default bbq1PngAsset
```

**Script entry:**

```ts
// @generated by remix/assets — do not edit manually
// source: app/entry.tsx
const entryTsxAsset = {
  href: '/assets/app/entry-ABC123.js',
  preloads: [
    '/assets/app/entry-ABC123.js',
    '/assets/app/components/App-DEF456.js',
    '/assets/app/utils/greet-GHI789.js',
  ],
} as const
export default entryTsxAsset
```

`preloads` contains all transitive static imports for the entry, used to generate `<link rel="modulepreload">` tags. Dynamic imports are excluded (they load on demand).

> **On the "self-reference" concern:** At first glance it might seem like a script entry's `.build.ts` file has a circular dependency — it lists its own URL in `preloads`. In practice this is not an issue. Script entry `.build.ts` files are server-side only — they are not part of the browser module graph, only used by server code to know what URLs to embed in HTML. The hash in each URL is derived from the compiled output file's content alone. There is no circular dependency. (File asset `.build.ts` files, by contrast, are compiled to `.js` and are loaded by the browser as real modules.)

### Generated file marker

Every generated file begins with:

```
// @generated by remix/assets — do not edit manually
```

This marker serves two purposes: it communicates to developers not to edit these files, and it provides a machine-readable identifier that lets the cleanup process safely detect and delete stale generated files without touching user-authored files.

---

## Conditions-Based Resolution

Node.js subpath imports support conditions, allowing different files to be selected at module resolution time based on flags passed to the Node.js process — no runtime branching, no dead code in bundles.

```json
// package.json
{
  "imports": {
    "#assets/*": {
      "placeholder": "./.assets/*.placeholder.ts",
      "default": "./.assets/*.build.ts"
    }
  }
}
```

`placeholder` is a **custom condition** — it is not set automatically by Node.js. Consumers must pass it explicitly via `--conditions`, or configure it in their bundler. The name reflects its purpose in every context: "give me placeholder asset URLs." This replaces the earlier `development` condition, which was semantically wrong when used during production builds.

| Scenario             | Command                             | Condition     | Resolves to                |
| -------------------- | ----------------------------------- | ------------- | -------------------------- |
| Dev server           | `node --conditions=placeholder ...` | `placeholder` | `.assets/*.placeholder.ts` |
| Tests                | `node --conditions=placeholder ...` | `placeholder` | `.assets/*.placeholder.ts` |
| Production server    | `node ...`                          | `default`     | `.assets/*.build.ts`       |
| esbuild (build step) | configured via `conditions` option  | `placeholder` | `.assets/*.placeholder.ts` |

### Consumer script configuration

```json
// package.json scripts (consumer's responsibility)
{
  "dev": "NODE_OPTIONS='--conditions=placeholder' tsx watch server.ts",
  "test": "node --conditions=placeholder --test './src/**/*.test.ts'",
  "start": "tsx server.ts"
}
```

Consumers have full control over which condition to use in each context. We don't force any specific mapping.

### TypeScript: `customConditions`

TypeScript 5.0+ supports `customConditions` in `tsconfig.json`, which lets TypeScript mirror Node.js conditions at type-check time. We use `customConditions: ["placeholder"]` so that TypeScript resolves `#assets/*` to the `.placeholder.ts` files via `package.json#imports` — the same resolution path used at runtime in dev mode.

This works before any build because the `placeholder` condition maps to `.placeholder.ts` files, which are checked in to source control. The `default` condition (which would map to `.build.ts`) is never used by TypeScript. Since placeholder and build files always export the same names with the same `string` types, type-checking against placeholder files is valid for any environment.

```json
// tsconfig.json (consumer's responsibility)
{
  "compilerOptions": {
    "customConditions": ["placeholder"]
  }
}
```

### What we don't do

We do not modify the consumer's `tsconfig.json`, `package.json`, or any other config files. Codegen only writes to the `.assets/` directory. Configuring `#imports`, `customConditions`, and `--conditions` flags is the consumer's responsibility — these are straightforward one-time setup steps.

---

## Codegen

Codegen lives in the core `assets` package — the "unbundler" — because it has the deepest knowledge of source paths, file rules, and variant configurations. The `dev-assets-middleware` depends on `assets` and delegates to it.

### `codegenPlaceholders(options)`

One-shot generation of `.placeholder.ts` files. Suitable for CI and pre-typecheck scripts:

```sh
pnpm run codegen && pnpm run typecheck
```

Behavior:

- Scans all source files matching `scripts` and `files` config patterns
- Generates `.placeholder.ts` files for any that are missing or whose source variant config has changed
- Deletes stale `.placeholder.ts` files where the source file no longer exists (identified by the `@generated` marker)
- Does **not** generate `.build.ts` files — that's the build step's job

### `watchCodegenPlaceholders(options)`

Long-running watcher that keeps `.placeholder.ts` files up to date. Used by `dev-assets-middleware`.

Behavior:

- Runs a full `codegenPlaceholders()` pass synchronously on startup before resolving its promise, so Node.js can import all `#assets/...` paths immediately when the server starts
- Watches for file additions and deletions matching the configured patterns
- Creates `.placeholder.ts` for new source files
- Deletes `.placeholder.ts` for removed source files
- Does **not** re-run when file _contents_ change — placeholder URLs are derived purely from source paths, not file contents, so there is nothing to regenerate. This is a key part of what makes the approach fast: the only events that trigger codegen are file additions and deletions, not the far more frequent saves during active development

### Why we recommend checking placeholder files in

Our recommended workflow is to check `.placeholder.ts` files in to source control rather than gitignoring them. The key benefit is that **type checking and tests work on a fresh clone** — when a developer clones the repo and runs `pnpm run typecheck` or `pnpm run test`, Node.js needs to resolve `#assets/...` imports immediately at module load time. If `.placeholder.ts` files were gitignored and only generated at dev server startup, both commands would fail without first running the dev server — a confusing and fragile DX.

This is safe because placeholder file content is derived entirely from the source path — it never depends on file contents, build output, or variant processing. A `.placeholder.ts` file will never go stale due to content changes; only adding or removing source files can change what needs to be generated.

Teams that prefer not to check in generated files can gitignore `.placeholder.ts` files and run `codegenPlaceholders()` as a pre-step in their CI and local dev workflows instead.

### `checkCodegenPlaceholders(options)`

Read-only validation that the checked-in `.placeholder.ts` files exactly match what `codegenPlaceholders()` would produce. Returns `{ ok, missing, stale, outdated, unknown }` where:

- **`missing`**: `.placeholder.ts` files that should exist but are absent from disk
- **`stale`**: `.placeholder.ts` files on disk with no matching source file or rule
- **`outdated`**: `.placeholder.ts` files whose content differs from what would be generated
- **`unknown`**: Files in the `codegenDir` that are neither `.placeholder.ts` nor `.build.ts` (only affects `ok` when `allowUnknownFiles` is not set)

Intended to run as part of CI checks on pull requests, alongside linting and type checking, to prevent merging code where source files and committed `.placeholder.ts` files are out of sync:

```sh
pnpm run codegen:check  # fails if any .placeholder.ts files are missing, stale, or outdated
```

Does not write anything to disk. If the check fails, run `codegenPlaceholders()` to regenerate and commit the result.

> **Agent impact:** `checkCodegenPlaceholders()` gives agents a clean, read-only way to verify their own work after adding, renaming, or deleting assets — without needing to start the dev server or observe runtime behavior. An agent can call it programmatically after making file changes, inspect the `{ ok, missing, stale, outdated, unknown }` result, and take corrective action (re-running `codegenPlaceholders()`) before proceeding. This closes a feedback loop that would otherwise only be detectable at runtime. Together with type checking, it means an agent working on asset-related code can get high confidence that everything is consistent purely from static analysis.

### Why eager generation is required (despite the lazy dev philosophy)

The `dev-assets-middleware` is designed around laziness: source files are only transformed when the browser requests them. This keeps startup fast and avoids processing files that are never accessed.

**This laziness cannot apply to codegen.** Node.js resolves `#assets/...` imports at module load time — when `import entryAsset from '#assets/app/entry.tsx'` is executed, Node.js looks up `.assets/app/entry.tsx.placeholder.ts` immediately. If that file doesn't exist, Node throws. There is no way to defer this to request time.

Therefore `watchCodegenPlaceholders()` must complete its initial scan and generate all missing `.placeholder.ts` files before the dev server can safely start. Since placeholder files are checked in to source control, in practice this initial pass is fast (it only generates files for assets added since the last commit).

### Integration with `dev-assets-middleware`

`dev-assets-middleware` calls `watchCodegenPlaceholders()` from `assets` on startup automatically. Consumers using `createDevAssets()` get this behavior for free — no separate watcher process or script is needed.

Because `watchCodegenPlaceholders()` holds an open file watcher, `createDevAssets()` returns a `{ middleware, close }` object rather than a bare middleware function. The `close()` method stops the watcher and should be called on server shutdown:

```ts
let devAssets = createDevAssets({ source, allow: ['app/**'] })

// Use the middleware in your router
createRouter({ middleware: [devAssets.middleware] })

// On shutdown, stop the file watcher
devAssets.close()
```

`createDevAssets()` is **synchronous** — it returns immediately without blocking on codegen completion. The watcher is started in the background, and the middleware awaits it on the first request. This means: in practice, by the time the browser sends its first request, codegen is already complete (startup time >> codegen time for typical projects); if for some reason the first request arrives before codegen finishes, the middleware will wait.

Internally, `createDevAssets()` does roughly:

```ts
import { watchCodegenPlaceholders } from '@remix-run/assets'

let codegenInit = watchCodegenPlaceholders({ source, codegenDir }).then((w) => {
  watcher = w
})

let middleware = async (context, next) => {
  await codegenInit // waits on first request if needed
  context.assets = { resolve: resolveAsset }
  let response = await handler.serve(context.request)
  if (response) return response
  return next()
}
```

---

## Build Step Integration

### `remix/assets` internal build

The `build()` function in `assets` runs all phases internally and generates `.build.ts` files alongside the manifest. Because `.build.ts` files for file assets are part of the browser module graph — compiled one-to-one to `.js` output files and loaded as real modules by the browser — they must be handled correctly throughout the pipeline.

**Phase 1 — File assets**

- Hash and transform all non-JS file assets (images, etc.) according to `files` config
- Write processed output files to `outDir`
- Generate `.assets/*.build.ts` for each file asset — hashed URLs are now known

**Phase 2 — Script assets (unbundled)**

- Resolve module graph from script entry points using esbuild for module resolution; esbuild resolves `#assets/...` imports via `package.json#imports` with `conditions: ['placeholder']`, following them into the `.placeholder.ts` files generated by codegen — these become part of the module graph
- Transform each source file and each `.placeholder.ts` file one-to-one via esbuild (unbundled: 1 input → 1 output); `.placeholder.ts` files compile to tiny `.js` modules containing `/__@assets/` placeholder strings
- Assign preliminary content hashes to each output file

**Phase 3 — Placeholder substitution (in-memory cascade)**

- Substitute `/__@assets/path` strings in compiled output with real hashed URLs (1:1)
- Expand `['/__@assets/path#preloads']` single-element arrays to the full transitive dependency list (1:N)
- Recompute content hashes for every modified file → determine final filenames
- Cascade topologically (leaves first, entry points last): update import paths in dependent files → their content changes → their hashes change → continue upward
- Rename output files with correct final hashes; update source map references
- This phase runs in-memory before anything is written to disk, so source map positions are always correct for the internal build

**Phase 4 — Build codegen**

- Generate `.assets/*.build.ts` for each script entry with the final `href` (hashed URL) and `preloads` (full transitive static import list) — server-side only, used by server code to embed the correct `<script src>` and `<link rel="modulepreload">` tags in HTML; not loaded by the browser
- Write manifest JSON

### External bundler workflow (esbuild, Rollup, etc.)

For consumers using their own bundler instead of `remix/assets build()`, the same phases are broken out as explicit API calls:

```ts
// Step 1: Generate placeholder files (run once, commit to source control)
await codegenPlaceholders({ source })

// Step 2: Build file assets with remix/assets (images, etc.)
await build({ source: { files: source.files }, outDir, baseUrl, manifest: filesManifestPath })
let filesManifest = JSON.parse(await fs.readFile(filesManifestPath, 'utf-8'))

// Step 3: Bundle scripts with esbuild using the placeholder condition
let result = await esbuild.build({
  entryPoints: source.scripts,
  conditions: ['placeholder'], // resolves #assets/ to .placeholder.ts
  write: true,
  metafile: true,
  // ... rest of config
})

// Build a combined manifest from esbuild metafile + file asset manifest
let manifest = {
  scripts: { outputs: scriptOutputs },
  files: { outputs: filesManifest.files.outputs },
}

// Step 4: Substitute /__@assets/ placeholder strings, recompute hashes, rename files, cascade
await substituteAssetPlaceholders({ manifest, baseUrl, outDir })

// Step 5: Generate .build.ts files for production server runtime
await codegenBuild({ manifest, baseUrl })
```

### `substituteAssetPlaceholders(options)`

The post-processing pass that makes the external bundler workflow possible. Because output filenames contain content hashes, changing file content makes the existing hash in the filename stale. This function:

1. **Substitutes placeholder strings** in all output files:
   - `"/__@assets/path"` → real hashed URL (1:1)
   - `["/__@assets/path#preloads"]` → expands single-element array to full transitive preload list (1:N)
2. **Recomputes content hashes** for every modified file → determines new filename
3. **Cascades topologically**: updates all files that reference old filenames → those files' content changes → their hashes change → continue upward to entry points
4. **Renames files** with correct final hashes, deletes old files, updates the manifest in-place
5. **Updates source map references**: renames the accompanying `.map` file alongside each renamed JS file and updates the `//# sourceMappingURL=` comment

Content hashing uses the Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`) to compute an 8-character base36 lowercase hash (a-z0-9) of the file content. The `//# sourceMappingURL=` comment is stripped before hashing so the hash is stable and independent of the map filename.

The optional `renameFile` callback handles the variety of hash patterns across bundlers:

```ts
substituteAssetPlaceholders({
  manifest,
  baseUrl: '/assets',
  outDir: './build/assets',
  // Default: replaces the trailing -HASH segment before the file extension
  renameFile: (oldPath, newHash) => oldPath.replace(/-[A-Za-z0-9]+(\.[^.]+)$/, `-${newHash}$1`),
})
```

The manifest is **mutated in-place** to reflect renamed output paths.

### `codegenBuild(options)`

Generates `.build.ts` files from a manifest for production server runtime. Called after the build (and after `substituteAssetPlaceholders` for the external bundler workflow):

```ts
await codegenBuild({ manifest, baseUrl: '/assets' })
```

### esbuild and `#assets/*`

esbuild respects `package.json#imports` natively and supports conditions via the `conditions` build option. No custom plugin is required. Configuring `conditions: ['placeholder']` is sufficient for esbuild to resolve `#assets/...` imports to `.placeholder.ts` files and include them in the module graph.

### File asset vs. script entry `.build.ts` distinction

| Asset type               | `.build.ts` loaded by browser?                           | Purpose                                                                 |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| File asset (image, etc.) | ✅ Yes — compiled to a `.js` module, imported at runtime | Provides the hashed URL as a module export                              |
| Script entry             | ❌ No — server-side only                                 | Tells the server what `<script src>` URL and preloads to emit into HTML |

---

## Configurable Output

### `codegenDir` option

Controls where generated files are written. Present on `codegenPlaceholders()`, `checkCodegenPlaceholders()`, `watchCodegenPlaceholders()`, `codegenBuild()`.

```ts
await codegenPlaceholders({
  source,
  codegenDir: '.assets', // default
})
```

### Custom extension suffix

Deferred. See Deferred Decisions.

---

## Cleanup

Stale generated files — where the source no longer exists — are identified by the `@generated` marker:

- `codegenPlaceholders()` scans `.assets/` for marker files, cross-references against current source files, and deletes orphans
- `watchCodegenPlaceholders()` handles deletions reactively via the file watcher
- A `clean` utility (or a `clean: true` option) can delete all generated files for a full reset

This approach is safe because the marker is unique to our generated files — user-authored files in `.assets/` would not have it.

---

## What Works After Clone (No Build)

| Scenario                | Works? | Reason                                                                                                                     |
| ----------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`    | ✅     | Placeholder files checked in; `customConditions: ["placeholder"]` resolves to `.placeholder.ts`                            |
| `pnpm run test`         | ✅     | `--conditions=placeholder` resolves to `.placeholder.ts`                                                                   |
| `pnpm run dev`          | ✅     | `watchCodegenPlaceholders()` initial pass is fast (placeholder files checked in); dev middleware serves `/__@assets/` URLs |
| `pnpm run start` (prod) | ❌     | Requires `pnpm run build` first to generate `.build.ts` files                                                              |

This is the intended experience. Requiring a build before starting in production is natural and expected.

---

## Relationship to `context.assets.resolve()`

The static import approach complements `context.assets.resolve()` rather than replacing it. Both APIs serve different needs and will coexist indefinitely.

Static imports cover the common case: you know at author-time which specific asset you want, and you want a static guarantee it exists. But there are use cases where dynamic resolution is the right tool. A concrete example from the bookstore demo: client entry points are detected automatically at runtime by scanning for `clientEntry()` usage and `import.meta.url` references. In dev, any `.ts` file is a potential entry point. You can't statically import all of these because you don't know upfront which files will be entries — the resolution is inherently dynamic. `context.assets.resolve()` handles this naturally.

In short:

- `context.assets.resolve()` — dynamic resolution, runtime-known paths, framework internals
- Static asset imports — author-time-known paths, static guarantees, the common case for user code

---

## Demo: `demos/assets`

The assets demo demonstrates the DX difference between dynamic resolution and static imports, with several sections:

1. **"Same source, three variants (dynamic resolve)"** — BBQ book cover (`bbq-2.png`, `bbq-1.png`) resolved via `assets.resolve()` at request time with null checks and runtime resolution.

2. **"Default variant"** — `bbq-1.png` imported statically and accessed via `.href` (the `defaultVariant`):

```ts
import bbq1PngAsset from '#assets/app/images/books/bbq-1.png'

bbq1PngAsset.href // default variant URL ('card')
```

3. **"Other images using the same variants (static imports)"** — `heavy-metal-1.png` and `three-ways-1.png` imported statically:

```ts
import heavyMetal1PngAsset from '#assets/app/images/books/heavy-metal-1.png'
import threeWays1PngAsset from '#assets/app/images/books/three-ways-1.png'

heavyMetal1PngAsset.variants.card.href
threeWays1PngAsset.variants.card.href
```

4. **"Web Worker (cross-script `#assets/` import)"** — the entry script imports the worker asset via `#assets/app/worker.ts` to get the worker's hashed URL:

```ts
import workerAsset from '#assets/app/worker.ts'

new Worker(workerAsset.href, { type: 'module' })
```

This demonstrates the key cross-script `#assets/` use case: client code that imports the URL of another script entry at build time. The `placeholder` condition enables the bundler to traverse this import during Phase 2 using the `.placeholder.ts` file, then `substituteAssetPlaceholders` replaces the `/__@assets/app/worker.ts` string with the real hashed URL in Phase 3.

The demo supports two build modes:

- `pnpm build` — uses `remix/assets build()` internally (unbundled, one output per source file)
- `pnpm build:bundled` — uses esbuild for JS bundling + `substituteAssetPlaceholders` + `codegenBuild` (fully bundled, demonstrates the external bundler workflow)

The demo's `package.json` has `#imports` configured with the `placeholder` condition, the dev script uses `--conditions=placeholder`, and the `.assets/` directory with placeholder files for all images and scripts is checked in.

---

## Package Changes

| Package                 | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assets`                | Renamed `codegen()` → `codegenPlaceholders()`, `codegenCheck()` → `checkCodegenPlaceholders()`, `codegenWatch()` → `watchCodegenPlaceholders()`. Added `codegenBuild()` and `substituteAssetPlaceholders()`. Extended `build()` with internal Phase 3 (substitution cascade). Renamed file suffix `.dev.ts` → `.placeholder.ts`. Renamed `filesCache` default. Added `codegenDir` option. Unified all placeholder URLs under `/__@assets/`. Added `#preloads` fragment marker. |
| `dev-assets-middleware` | Calls `watchCodegenPlaceholders()` from `assets` on startup. `createDevAssets()` is now synchronous; codegen awaits internally on first request. Dev handler serves `/__@assets/` URLs (replacing `/__@files/`).                                                                                                                                                                                                                                                               |
| `assets-middleware`     | No changes required.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Consumer app            | Configure `package.json#imports` with `placeholder` condition, `tsconfig.json` `customConditions: ["placeholder"]`, and `--conditions=placeholder` flags in scripts. Use `import X from '#assets/...'` (default import). Codegen handles only `.assets/`.                                                                                                                                                                                                                      |

---

## Deferred Decisions

- **Custom extension suffix / adjacent file placement**: A configurable suffix (e.g., `.asset.ts`) would allow generated files to sit adjacent to source files, enabling relative imports (`./logo.png.asset.ts`) instead of root-relative subpath imports (`#assets/app/images/logo.png`). Deferred — adjacent placement scatters files through the source tree and complicates the `package.json#imports` pattern (can't use a single prefix). Centralised `codegenDir` model ships first.
- **JS output instead of TS**: The generated files are simple enough to emit as `.js` with JSDoc comments rather than `.ts`. The appeal: `.js` files are loadable by plain Node.js without a TypeScript runner, making the system more broadly compatible. The tradeoff: inconsistency with the rest of a TypeScript codebase, and `allowJs` may be required in the consumer's tsconfig. Worth exploring, but default to `.ts` for now and make it a configurable `codegenFormat` option later.
- **Manifest coexistence**: Does the manifest JSON eventually get deprecated, or do both coexist permanently? The manifest is still useful for tooling that introspects the full build graph (e.g., a hypothetical framework layer that needs all entry points). Likely keep both for now.
- **`router.close()` for first-class middleware lifecycle management**: Currently, middleware that holds resources (like `createDevAssets()`'s file watcher) requires consumers to manually call `devAssets.close()` on shutdown. This is error-prone — you need to know which middleware needs closing and wire it up yourself. A `router.close(): Promise<void>` method on the router itself would be a cleaner pattern: middleware could register cleanup callbacks, and consumers would simply call `router.close()` on shutdown without needing to track individual middleware instances. Outside the scope of this work and not a blocker, but worth exploring as a core router feature.
- **`substituteAssetPlaceholders` with in-memory esbuild output**: Current implementation requires files to be on disk (`write: true`). An `onEnd`-plugin variant that operates on in-memory buffers would be cleaner and avoid an intermediate disk write. Not yet implemented.
- **Bundler wrapper packages**: As the external bundler orchestration grows, a dedicated `assets-compiler-esbuild` package could make sense: hand it an esbuild config, it runs all phases in the right order. For now this is implemented manually in the demo apps.
- **Source map position accuracy**: After substitution, `.map` files are renamed and the `sourceMappingURL` comment is updated, but character-level source positions in the map are not recomposed. Substitutions that change string lengths shift subsequent positions. For `remix/assets`'s own internal build this isn't an issue (maps are generated after substitution). For the external bundler flow, positions may be slightly off near substituted strings.
