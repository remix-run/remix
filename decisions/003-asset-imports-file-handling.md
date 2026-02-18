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
import { defineFiles } from '@remix-run/assets'
import sharp from 'sharp'

export const files = defineFiles([
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
])
```

Each variant produces a separate output file with its own content hash. The `defaultVariant` identifies the primary representation when no specific variant is requested. File assets without variants (e.g., a plain font or a favicon) are also supported — they're matched and tracked but passed through without transformation.

### The current resolution API

> **Naming note:** `context.assets.resolve()` was previously called `context.assets.get()`. It was renamed to `resolve()` for consistency across all `assets`-related packages — the concept is resolving asset paths, and "get" was ambiguous (a getter? getting what?). The rename establishes a single consistent noun ("resolver") and verb ("resolve") throughout.

The current asset resolution API has two sides:

**Development** (`dev-assets-middleware`): The `createDevAssets()` function sets up `context.assets.resolve()` on the request context. Calling it returns `{ href, preloads }` where `href` is a `/__@files/...` URL pointing to the source file on disk, served and transformed on-the-fly by the dev handler. Scripts get `href: '/app/entry.tsx'`. File assets (images, etc.) get `href: '/__@files/app/images/logo.png?@thumbnail'`. The middleware is intentionally lazy — it only processes files when the browser actually requests them.

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

To ever support client-side asset resolution via `resolve()`, you'd need to ship the entire manifest to the browser. There's no way to code-split it or load only what you need. With static imports, each import is an independent module — only what's imported is included in the bundle.

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
import * as logoAsset from '#assets/app/images/logo.png'
import * as bbqAsset from '#assets/app/images/books/bbq-1.png'
import * as entryAsset from '#assets/app/entry.tsx'
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

- **Static guarantee**: If `app/images/logo.png` doesn't exist, the `.dev.ts` file won't be generated, and the import fails at compile time (TS can't find the module). No null checks needed. For agents, this means a failing type check is a precise, actionable signal: re-run codegen, or the referenced file genuinely doesn't exist and the agent needs to reconsider its approach — either way, the feedback is immediate and unambiguous.
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
    entry.tsx.dev.ts        ← dev URLs — checked in to source control
    entry.tsx.build.ts      ← production URLs — gitignored, generated by build
    images/
      logo.png.dev.ts
      logo.png.build.ts
      books/
        bbq-1.png.dev.ts
        bbq-1.png.build.ts
```

`.gitignore`:

```
.assets/**/*.build.ts
```

The `.assets/` directory itself is NOT gitignored — only the `.build.ts` files within it.

### Why two separate files, not one index file with a runtime branch

An earlier approach considered generating an index file that branched at runtime:

```ts
// Rejected approach
const isDev = process.env.NODE_ENV === 'development'
import default_dev from './.assets/logo.png.dev.ts'
import default_build from './.assets/logo.png.build.ts'
export default isDev ? default_dev : default_build
```

This was rejected for two reasons:

1. Both dev and build URL strings would be included in the browser bundle, unless the bundler can statically eliminate dead code on `process.env.NODE_ENV`. Even when that works, it's indirect.
2. It's noisier — an extra file per asset that only exists to proxy the other two.

Instead, we use Node.js import conditions to select the correct file at resolution time, with no runtime branching and no extra files.

### Output directory

Default: `.assets/` (configurable via `codegenDir` option).

> **Note:** The dev file transform cache previously defaulted to `./.assets/files-cache`. It was renamed to `.assets-cache` to free up `.assets/` for the generated type files. Since this package had not shipped and had no external consumers, this was a free change.

The `filesCache` option default was changed from `'./.assets/files-cache'` to `'./.assets-cache'`.

---

## Generated File Format

### Dev files (checked in)

Dev URLs are derived purely from the source path — they don't depend on file contents, variant processing, or build output. This is what makes them safe to check in: they never go stale due to content changes. The dev handler serves them on-the-fly via the `/__@files/` route.

**File asset, with variants and `defaultVariant: 'card'`:**

```ts
// @generated by remix/assets — do not edit manually
// source: app/images/books/bbq-1.png
export const href = '/__@files/app/images/books/bbq-1.png?@card'
export const variants = {
  thumbnail: { href: '/__@files/app/images/books/bbq-1.png?@thumbnail' },
  card: { href: '/__@files/app/images/books/bbq-1.png?@card' },
  hero: { href: '/__@files/app/images/books/bbq-1.png?@hero' },
}
```

`href` at the top level exports the `defaultVariant` URL. When a file rule has variants but no `defaultVariant`, there is no top-level `href` export — only `variants`. The `variants` object always contains an entry for every variant name from the `files` config, each with its own `href` property. (For file assets with no variants at all, only `href` is exported — see example below.)

**File asset, without variants:**

```ts
// @generated by remix/assets — do not edit manually
// source: app/images/logo.png
export const href = '/__@files/app/images/logo.png'
```

**Script entry:**

```ts
// @generated by remix/assets — do not edit manually
// source: app/entry.tsx
export const href = '/app/entry.tsx'
export const preloads = ['/app/entry.tsx']
```

In dev, `preloads` is always `[href]` — there is no module splitting in dev mode, so the entry is its own only preload.

### Build files (gitignored)

Generated by the build step after hashing is complete.

**File asset, with variants:**

```ts
// @generated by remix/assets — do not edit manually
// source: app/images/books/bbq-1.png
export const href = '/assets/app/images/books/bbq-1-card-ABC123.jpg'
export const variants = {
  thumbnail: { href: '/assets/app/images/books/bbq-1-thumbnail-XYZ789.jpg' },
  card: { href: '/assets/app/images/books/bbq-1-card-ABC123.jpg' },
  hero: { href: '/assets/app/images/books/bbq-1-hero-DEF456.jpg' },
}
```

**Script entry:**

```ts
// @generated by remix/assets — do not edit manually
// source: app/entry.tsx
export const href = '/assets/app/entry-ABC123.js'
export const preloads = [
  '/assets/app/entry-ABC123.js',
  '/assets/app/components/App-DEF456.js',
  '/assets/app/utils/greet-GHI789.js',
]
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
      "development": "./.assets/*.dev.ts",
      "test": "./.assets/*.dev.ts",
      "default": "./.assets/*.build.ts"
    }
  }
}
```

`development` and `test` are **custom conditions** — they are not set automatically by Node.js. Consumers must pass them explicitly via `--conditions`:

| Scenario             | Command                             | Condition     | Resolves to          |
| -------------------- | ----------------------------------- | ------------- | -------------------- |
| Dev server           | `node --conditions=development ...` | `development` | `.assets/*.dev.ts`   |
| Tests                | `node --conditions=test --test ...` | `test`        | `.assets/*.dev.ts`   |
| Production server    | `node ...`                          | `default`     | `.assets/*.build.ts` |
| esbuild (build step) | configured via `conditions` option  | `default`     | `.assets/*.build.ts` |

### Consumer script configuration

```json
// package.json scripts (consumer's responsibility)
{
  "dev": "node --conditions=development --import tsx/esm server.ts",
  "test": "node --conditions=test --test './src/**/*.test.ts'",
  "start": "node --import tsx/esm server.ts"
}
```

Consumers have full control over which condition to use in each context. We don't force any specific mapping.

### TypeScript: `customConditions`

TypeScript 5.0+ supports `customConditions` in `tsconfig.json`, which lets TypeScript mirror Node.js conditions at type-check time. We use `customConditions: ["development"]` so that TypeScript resolves `#assets/*` to the `.dev.ts` files via `package.json#imports` — the same resolution path used at runtime in dev mode.

This works before any build because the `development` condition maps to `.dev.ts` files, which are checked in to source control. The `default` condition (which would map to `.build.ts`) is never used by TypeScript. Since dev and build files always export the same names with the same `string` types, type-checking against dev files is valid for any environment.

```json
// tsconfig.json (consumer's responsibility)
{
  "compilerOptions": {
    "customConditions": ["development"]
  }
}
```

### What we don't do

We do not modify the consumer's `tsconfig.json`, `package.json`, or any other config files. Codegen only writes to the `.assets/` directory. Configuring `#imports`, `customConditions`, and `--conditions` flags is the consumer's responsibility — these are straightforward one-time setup steps.

---

## Codegen

Codegen lives in the core `assets` package — the "unbundler" — because it has the deepest knowledge of source paths, file rules, and variant configurations. The `dev-assets-middleware` depends on `assets` and delegates to it.

### `codegen(options)`

One-shot generation of `.dev.ts` files. Suitable for CI and pre-typecheck scripts:

```sh
pnpm run codegen && pnpm run typecheck
```

Behavior:

- Scans all source files matching `scripts` and `files` config patterns
- Generates `.dev.ts` files for any that are missing or whose source variant config has changed
- Deletes stale `.dev.ts` files where the source file no longer exists (identified by the `@generated` marker)
- Does **not** generate `.build.ts` files — that's the build step's job

### `codegenWatch(options)`

Long-running watcher that keeps `.dev.ts` files up to date. Used by `dev-assets-middleware`.

Behavior:

- Runs a full `codegen()` pass synchronously on startup before resolving its promise, so Node.js can import all `#assets/...` paths immediately when the server starts
- Watches for file additions and deletions matching the configured patterns
- Creates `.dev.ts` for new source files
- Deletes `.dev.ts` for removed source files
- Does **not** re-run when file _contents_ change — dev URLs are derived purely from source paths, not file contents, so there is nothing to regenerate. This is a key part of what makes the approach fast: the only events that trigger codegen are file additions and deletions, not the far more frequent saves during active development

### Why we recommend checking dev files in

Our recommended workflow is to check `.dev.ts` files in to source control rather than gitignoring them. The key benefit is that **type checking and tests work on a fresh clone** — when a developer clones the repo and runs `pnpm run typecheck` or `pnpm run test`, Node.js needs to resolve `#assets/...` imports immediately at module load time. If `.dev.ts` files were gitignored and only generated at dev server startup, both commands would fail without first running the dev server — a confusing and fragile DX.

This is safe because dev file content is derived entirely from the source path — it never depends on file contents, build output, or variant processing. A `.dev.ts` file will never go stale due to content changes; only adding or removing source files can change what needs to be generated.

Teams that prefer not to check in generated files can gitignore `.dev.ts` files and run `codegen()` as a pre-step in their CI and local dev workflows instead.

### codegenCheck(options)

Read-only validation that the checked-in `.dev.ts` files exactly match what `codegen()` would produce. Returns `{ ok, missing, stale, outdated }` where:

- **`missing`**: `.dev.ts` files that should exist but are absent from disk
- **`stale`**: `.dev.ts` files on disk with no matching source file or rule
- **`outdated`**: `.dev.ts` files whose content differs from what would be generated

Intended to run as part of CI checks on pull requests, alongside linting and type checking, to prevent merging code where source files and committed `.dev.ts` files are out of sync:

```sh
pnpm run codegen:check  # fails if any .dev.ts files are missing, stale, or outdated
```

Does not write anything to disk. If the check fails, run `codegen()` to regenerate and commit the result.

> **Agent impact:** `codegenCheck()` gives agents a clean, read-only way to verify their own work after adding, renaming, or deleting assets — without needing to start the dev server or observe runtime behavior. An agent can call it programmatically after making file changes, inspect the `{ ok, missing, stale, outdated }` result, and take corrective action (re-running `codegen()`) before proceeding. This closes a feedback loop that would otherwise only be detectable at runtime. Together with type checking, it means an agent working on asset-related code can get high confidence that everything is consistent purely from static analysis.

### Why eager generation is required (despite the lazy dev philosophy)

The `dev-assets-middleware` is designed around laziness: source files are only transformed when the browser requests them. This keeps startup fast and avoids processing files that are never accessed.

**This laziness cannot apply to codegen.** Node.js resolves `#assets/...` imports at module load time — when `import * as entryAsset from '#assets/app/entry.tsx'` is executed, Node.js looks up `.assets/app/entry.tsx.dev.ts` immediately. If that file doesn't exist, Node throws. There is no way to defer this to request time.

Therefore `codegenWatch()` must complete its initial scan and generate all missing `.dev.ts` files before the dev server can safely start. Since dev files are checked in to source control, in practice this initial pass is fast (it only generates files for assets added since the last commit).

### Integration with `dev-assets-middleware`

`dev-assets-middleware` calls `codegenWatch()` from `assets` on startup automatically. Consumers using `createDevAssets()` get this behavior for free — no separate watcher process or script is needed.

Because `codegenWatch()` holds an open file watcher, `createDevAssets()` returns a `{ middleware, close }` object rather than a bare middleware function. The `close()` method stops the watcher and should be called on server shutdown:

```ts
const devAssets = createDevAssets({ scripts, files })

// Use the middleware in your router
createRouter({ middleware: [devAssets.middleware] })

// On shutdown, stop the file watcher
devAssets.close()
```

Internally, `createDevAssets()` does roughly:

```ts
import { codegenWatch } from 'remix/assets'

const watcher = await codegenWatch({ scripts, files, codegenDir })
// Now safe to start handling requests

return {
  middleware,
  close: () => watcher.close(),
}
```

---

## Build Step Integration

The `build()` function in `assets` generates `.build.ts` files alongside the manifest. Because `.build.ts` files are part of the module graph — compiled one-to-one to `.js` output files just like source files, and loaded as real modules by the browser (visible in the Network tab) — they must exist before the script transform pass runs so that esbuild can resolve `#assets/...` imports correctly during module graph discovery.

**Phase 1 — File assets**

- Hash and transform all non-JS file assets (images, etc.) according to `files` config
- Write processed output files to `outDir`
- Generate `.assets/*.build.ts` for each file asset — hashed URLs are now known

**Phase 2 — Script assets**

- Resolve module graph from script entry points using esbuild for module resolution; esbuild resolves `#assets/...` imports via `package.json#imports` with `conditions: ['default']`, following them into the `.build.ts` files generated in Phase 1 — these become part of the module graph
- Transform each source file and each `.build.ts` file one-to-one via esbuild (unbundled: 1 input → 1 output); `.build.ts` files compile to tiny `.js` modules (e.g., `export const href = '/assets/images/logo-ABC123.jpg'`) that the browser loads as normal module requests
- Assign content hashes to each output file
- Compute transitive static import graph to determine `preloads` arrays
- Generate `.assets/*.build.ts` for each script entry with `default` (the entry's own hashed URL) and `preloads` (all transitive static import URLs) — these are server-side only, used by server code to embed the correct `<script src>` and `<link rel="modulepreload">` tags in HTML; they are not loaded by the browser
- Write manifest JSON

### esbuild and `#assets/*`

esbuild respects `package.json#imports` natively and supports conditions via the `conditions` build option. No custom plugin is required. Configuring `conditions: ['default']` in the esbuild options for Phase 2 is sufficient for it to resolve `#assets/...` imports to the correct `.build.ts` files and include them in the module graph.

### File asset vs. script entry `.build.ts` distinction

| Asset type               | `.build.ts` loaded by browser?                           | Purpose                                                                 |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| File asset (image, etc.) | ✅ Yes — compiled to a `.js` module, imported at runtime | Provides the hashed URL as a module export                              |
| Script entry             | ❌ No — server-side only                                 | Tells the server what `<script src>` URL and preloads to emit into HTML |

---

## Configurable Output

### `codegenDir` option

Controls where generated files are written. Added to `codegen()`, `codegenWatch()`, and `build()`.

```ts
await build({
  scripts: ['app/entry.tsx'],
  files,
  outDir: './build/assets',
  codegenDir: '.assets', // default
})
```

### Custom extension suffix

Deferred. See Deferred Decisions.

---

## Cleanup

Stale generated files — where the source no longer exists — are identified by the `@generated` marker:

- `codegen()` scans `.assets/` for marker files, cross-references against current source files, and deletes orphans
- `codegenWatch()` handles deletions reactively via the file watcher
- A `clean` utility (or a `clean: true` option) can delete all generated files for a full reset

This approach is safe because the marker is unique to our generated files — user-authored files in `.assets/` would not have it.

---

## What Works After Clone (No Build)

| Scenario                | Works? | Reason                                                                                                |
| ----------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`    | ✅     | Dev files checked in; `customConditions: ["development"]` resolves to `.dev.ts`                       |
| `pnpm run test`         | ✅     | `--conditions=test` resolves to `.dev.ts`                                                             |
| `pnpm run dev`          | ✅     | `codegenWatch()` initial pass is fast (dev files checked in); dev middleware serves `/__@files/` URLs |
| `pnpm run start` (prod) | ❌     | Requires `pnpm run build` first to generate `.build.ts` files                                         |

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

The assets demo demonstrates two image sections side-by-side to make the DX difference immediately visible:

1. **"Same source, three variants"** — BBQ book cover (`bbq-1.png`) shown as `thumbnail`, `card`, and `hero`. This section uses `context.assets.resolve()` for comparison — it has null checks and runtime resolution.

2. **"Other images using the same variants"** — `heavy-metal-1.png` (thumbnail) and `three-ways-1.png` (card). These use static asset imports — plain string accesses with no ceremony.

```ts
import * as heavyMetalAsset from '#assets/app/images/books/heavy-metal-1.png'
import * as threeWaysAsset from '#assets/app/images/books/three-ways-1.png'

router.get('/', () => {
  let html = `...
    <img src="${heavyMetalAsset.variants.thumbnail.href}" width="120" />
    <img src="${threeWaysAsset.variants.card.href}" width="280" />
  ...`
  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
})
```

The demo's `package.json` has `#imports` configured, the dev script uses `--conditions=development`, and the `.assets/` directory with dev files for all images is checked in.

---

## Package Changes

| Package                 | Changes                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets`                | Added `codegen()`, `codegenWatch()`, `codegenCheck()`. Extended `build()` to generate `.build.ts` files. Renamed default `filesCache` from `.assets/files-cache` to `.assets-cache`. Added `codegenDir` option. |
| `dev-assets-middleware` | Calls `codegenWatch()` from `assets` on startup before accepting requests.                                                                                                                                      |
| `assets-middleware`     | No changes required.                                                                                                                                                                                            |
| Consumer app            | Configure `package.json#imports`, `tsconfig.json` `customConditions`, and `--conditions` flags in scripts. Codegen handles only `.assets/`.                                                                     |

---

## Deferred Decisions

- **Custom extension suffix / adjacent file placement**: A configurable suffix (e.g., `.asset.ts`) would allow generated files to sit adjacent to source files, enabling relative imports (`./logo.png.asset.ts`) instead of root-relative subpath imports (`#assets/app/images/logo.png`). Deferred — adjacent placement scatters files through the source tree and complicates the `package.json#imports` pattern (can't use a single prefix). Centralised `codegenDir` model ships first.
- **JS output instead of TS**: The generated files are simple enough to emit as `.js` with JSDoc comments rather than `.ts`. The appeal: `.js` files are loadable by plain Node.js without a TypeScript runner, making the system more broadly compatible. The tradeoff: inconsistency with the rest of a TypeScript codebase, and `allowJs` may be required in the consumer's tsconfig. Worth exploring, but default to `.ts` for now and make it a configurable `codegenFormat` option later.
- **Manifest coexistence**: Does the manifest JSON eventually get deprecated, or do both coexist permanently? The manifest is still useful for tooling that introspects the full build graph (e.g., a hypothetical framework layer that needs all entry points). Likely keep both for now.
- **`router.close()` for first-class middleware lifecycle management**: Currently, middleware that holds resources (like `createDevAssets()`'s file watcher) requires consumers to manually call `devAssets.close()` on shutdown. This is error-prone — you need to know which middleware needs closing and wire it up yourself. A `router.close(): Promise<void>` method on the router itself would be a cleaner pattern: middleware could register cleanup callbacks, and consumers would simply call `router.close()` on shutdown without needing to track individual middleware instances. Outside the scope of this work and not a blocker, but worth exploring as a core router feature.
