# In Progress Tasks

---

### API for multi-file-type asset handling (images, fonts, etc.) - Predefined Variants Approach

## TL;DR - Current Status

**Where we are:** typed-glob spike successful ✅, started implementing runtime params, **realized we were overcomplicating**, pivoted to predefined variants, and internalized typed-glob into `@remix-run/assets`.

**New direction (simpler):**

- Define variants upfront: `variants: { small: resize(200), large: resize(1200) }`
- Runtime just picks a variant: `assets.get('app/logo.png', 'small')`
- No runtime params → no security/validation/registry complexity
- Globs define rules per file type, adding new files doesn't need config changes
- Build pre-generates all variants, dev generates on-demand
- **Prod doesn't need config at all** - just reads manifest (JSON lookup)

**What we eliminated:**

- ❌ Runtime parameterization (was: `assets.get('path', { resize: { width: 200 } })`)
- ❌ Validation layer for arbitrary params
- ❌ Registry tracking `(source + params) → hash`
- ❌ Hybrid URL system (query params → hashed)
- ❌ Multiple deployment modes (dynamic, pre-gen+fallback, strict)
- ❌ Complex type inference from transform functions
- ❌ "Zero-runtime-dep" config pattern (no `import type` tricks needed)
- ❌ Async transform functions with dynamic imports
- ❌ Special "assetsConfig" object concept

**What stayed simple:**

- ✅ Glob-based file matching
- ✅ Transform functions: `(data, context?) => Buffer | { data, ext? }` - simple signature
- ✅ Optional context for advanced cases (path-aware logic, format conversion)
- ✅ Manifest in prod (no config needed), files config in dev/build
- ✅ Type safety via internal typed-glob module (path → variant names)
- ✅ Normal TypeScript - transforms use regular imports, run at build/dev time only

**Next:** Review implemented MVP in demo and confirm behavior.

## Implementation Status

- [x] Added `FilesConfig` API with `transform`, `variants`, and `defaultVariant`
- [x] Extended `build()` to generate file variants and emit manifest file mappings
- [x] Added production manifest lookup for file assets in `assets.get(path, variant?)`
- [x] Added development file asset handling via `assets.get(path, variant?)` + on-demand transform/cache endpoint
- [x] Added tests for file variants in build/dev/prod packages
- [x] Updated assets demo to use shared `files` config and expose variant URLs
- [x] Updated bookstore demo static images to use `assets.get()` + `files` transform (png -> jpg, no variants)
- [x] Added central module-augmentation setup so `context.assets.get()` infers valid variants from `files` config
- [x] Preserved existing script entry behavior while standardizing on nested manifest shape

## Discovered Requirements

- No backward-compatibility shim is needed for legacy flat manifests in this branch; we can standardize on `scripts.outputs` + `files.outputs`.
- `assets.get()` must remain synchronous for route handlers, so dev file transforms are resolved lazily by URL request handling rather than during `get()` execution.
- Dev variant caching needs a stable persistent key derived from source path, variant, and file metadata to avoid unnecessary re-transforms across restarts.
- For bookstore-style demos that use both unbundled and bundled builds, `build.bundled.ts` also needs to emit `manifest.files.outputs` to keep production behavior consistent.

## Remaining

- Manual review and validation in the demo app (dev and prod flows) before moving this task to `done/`.

---

## Background

The current assets package only handles JavaScript/TypeScript modules. It discovers the module graph from entry points and transforms files 1:1 (no bundling/chunking). This works well because the dependency graph is explicit (import statements), and the `assets.get()` API resolves URLs at runtime without needing build-time injection.

**Goal:** Extend assets to handle non-JS files (images, fonts, CSS, PDFs, etc.) while maintaining core principles:

1. **No "webpackscript"** - Assets aren't imported in JS; they're referenced via runtime API (`assets.get()`)
2. **Runtime resolution** - Use `assets.get()` instead of build-time injection to keep code testable in Node
3. **1:1 unbundling** - Each file is independently cacheable
4. **Test-friendly** - Code runs in Node without special tooling
5. **Simplicity first** - Go with the grain of the platform, only add abstractions where truly needed

## Journey: From Runtime Params to Predefined Variants

### Phase 1: typed-glob Spike (✅ Completed, then Internalized)

We successfully built a type-level glob matcher that enables compile-time path matching. This proved feasible for type-safe asset handling and is now a solid foundation.

**Key achievements:**

- Type-level glob parsing and matching (`*`, `**`, `?`, brace sets, character classes, extglobs)
- Good IDE autocomplete experience
- Minimatch parity testing infrastructure
- Internal module in `packages/assets/src/lib/typed-glob` with an explicit entrypoint (`index.ts`)

**Decision:** Viable as foundation for assets API type safety, but kept internal to `@remix-run/assets` instead of a public package.

### Phase 2: Runtime Parameterization Attempt (⚠️ Course Corrected)

After typed-glob succeeded, we started designing an API with **runtime transform parameters**:

```ts
// The approach we started with
assets.get('app/logo.png', { resize: { width: 200 } })
```

This led to significant complexity:

**Problems discovered:**

1. **Security concerns** - Runtime params = DOS vector (users can hammer different params)
2. **Complex validation layer** - Need to validate arbitrary param combinations at runtime
3. **Registry tracking** - Must track `(source + params) → hash` mappings across restarts
4. **Hybrid URL system** - Query params that progressively enhance to hashed URLs
5. **Multiple deployment modes** - Dynamic, pre-generate+fallback, strict (complexity explosion)
6. **Complex type inference** - Inferring param object shapes from async transform functions

**The realization:** Runtime parameterization treats transforms as **application-level concerns** that flow through route handlers. But image variants are **build-time assets** - you should know what you need before deployment, just like responsive images use predefined `srcset` sizes, not arbitrary dimensions.

### Phase 3: Predefined Variants (Current Direction)

**Core insight:** What if variants are just **named transformations defined upfront**?

```ts
// Config defines variants
files: [
  {
    include: 'app/**/*.{png,jpg}',
    variants: {
      small: async (input) => resize(input, 200),
      large: async (input) => resize(input, 1200),
    },
  },
]

// Runtime just picks a variant
assets.get('app/logo.png', 'small')
```

**What this eliminates:**

- ✅ No runtime params → no DOS concerns
- ✅ No validation layer (variants are predefined)
- ✅ No registry (just manifest lookup or cache)
- ✅ No hybrid URL system (just hashed filenames)
- ✅ No fallback modes (everything pre-generated or cached from known set)
- ✅ Simpler typing (string literal unions vs complex param objects)
- ✅ Simpler caching (just static files)

**Key benefits:**

1. **Organizational clarity** - Different directories can have different variant rules via globs
2. **Type safety via typed-glob** - Path literal → matching glob → union of variant names
3. **No config changes for new files** - Globs define rules, not individual files

## New API Design: Predefined Variants

**Core principles:**

1. **Variants are defined in config, not at runtime** - Transform configurations live in `assets.config.ts`
2. **Glob-based rules** - Define variants for file patterns, not individual files
3. **Simple functions** - Variants are just `async (input: Buffer) => Buffer` transformations
4. **Type-safe variant selection** - typed-glob matches paths to available variant names
5. **Zero-runtime-dep config** - Config uses `import type`, can be a devDependency

**Key design decisions:**

1. **Transform vs Variants:**

   - `transform`: Optional base transformation applied to all files matching the pattern
   - `variants`: Named transformations that reference the file
   - If `variants` are defined, you MUST specify which variant (types enforce this)
   - If only `transform` is defined, no variant param needed
   - Variants receive the output of `transform` if both are present

2. **Transform function signature:**

   - Simple case: `(data: Buffer) => Buffer`
   - Advanced: `(data: Buffer, { sourcePath, ext }) => Buffer | { data: Buffer, ext?: string }`
   - Second param provides context (file path, current extension)
   - Return `{ data, ext }` to change format (e.g., png → webp)
   - Pipeline preserves `sourcePath`, threads `ext` through transforms

3. **No magic reserved names:**

   - No special "original" or "default" variant names
   - Use explicit `defaultVariant` config option if optional variant param is desired
   - Forces clarity: "if you want this asset, which variant do you want?"

4. **Simple functions, not framework:**

   - Transform functions are just JavaScript
   - Composition via helper functions (not framework abstractions)
   - Access to context when needed (path-dependent logic, format conversion)

5. **Manifest-based prod, config-based dev:**
   - **Production:** Build scans filesystem, generates all variants, writes concrete file mappings to manifest
   - **Development:** Middleware reads config, generates variants on-demand from predefined set
   - **Types:** Inferred from config (not manifest) for compile-time safety

### API Examples

**Shared files config (optional, for DRY):**

```ts
// files-config.ts
import type { FilesConfig } from '@remix-run/assets'
import sharp from 'sharp'

export const files: FilesConfig = [
  // Example 1: Simple transform (no variants)
  {
    include: 'app/icons/**/*.svg',
    transform: (data) => optimizeSVG(data),
  },
  // Usage: assets.get('app/icons/logo.svg')

  // Example 2: Path-dependent logic
  {
    include: 'app/images/**/*.{png,jpg}',
    transform: (data, { sourcePath }) => {
      // Different quality based on directory
      let quality = sourcePath.includes('/hero/') ? 95 : 85
      return sharp(data).jpeg({ quality }).toBuffer()
    },
  },

  // Example 3: Format conversion
  {
    include: 'app/photos/**/*.png',
    variants: {
      webp: (data) => ({
        data: sharp(data).webp({ quality: 85 }).toBuffer(),
        ext: 'webp', // Change extension!
      }),
      avif: (data) => ({
        data: sharp(data).avif({ quality: 80 }).toBuffer(),
        ext: 'avif',
      }),
      fallback: (data) => sharp(data).jpeg({ quality: 85 }).toBuffer(),
      // No ext change = keeps original extension
    },
  },
  // Usage: assets.get('app/photos/hero.png', 'webp')
  // → Returns /app/photos/hero-webp-abc123.webp

  // Example 4: Transform + Variants (pipeline)
  {
    include: 'app/products/**/*.{png,jpg}',
    transform: (data) => ({
      data: sharp(data).webp({ quality: 90 }).toBuffer(),
      ext: 'webp', // Convert all to webp first
    }),
    variants: {
      thumbnail: (data) => sharp(data).resize(100, 100).toBuffer(),
      card: (data) => sharp(data).resize(400, 400).toBuffer(),
      hero: (data) => sharp(data).resize(1200, 800).toBuffer(),
    },
  },
  // Variants receive webp data, ext is 'webp'
  // Usage: assets.get('app/products/shoe.png', 'card')
  // → Returns /app/products/shoe-card-def456.webp

  // Example 5: Optional variant via defaultVariant
  {
    include: 'app/photos/**/*.jpg',
    variants: {
      optimized: (data) => sharp(data).jpeg({ quality: 85 }).toBuffer(),
      thumbnail: (data) => sharp(data).resize(200).jpeg({ quality: 80 }).toBuffer(),
    },
    defaultVariant: 'optimized',
  },
  // Usage:
  // assets.get('app/photos/hero.jpg')              // uses 'optimized'
  // assets.get('app/photos/hero.jpg', 'thumbnail') // explicit
]
```

**Transform function signatures:**

```ts
// Simple: Buffer in, Buffer out
transform: (data: Buffer) => Buffer

// Advanced: Access to context, optional format change
transform: (data: Buffer, context: { sourcePath: string, ext: string }) =>
  | Buffer
  | { data: Buffer, ext?: string }

// Context fields:
// - sourcePath: Always the original source file path (e.g., 'app/logo.png')
// - ext: Current extension (e.g., 'png', or 'webp' if transform changed it)
```

**Build script:**

```ts
// build.ts
import { build } from '@remix-run/assets'
import { files } from './files-config.ts'

await build({
  scripts: ['app/entry.tsx'],
  files,
  outDir: './build/assets',
  manifest: './build/assets-manifest.json',
})

// Result: All variants pre-generated
// - app/products/shoe-thumbnail-abc123.png
// - app/products/shoe-card-def456.png
// - app/products/shoe-hero-ghi789.png
// - manifest.json: { "app/products/shoe.png": { variants: {...} } }
```

**Server (dev vs prod):**

```ts
// server.ts
import { devAssets } from '@remix-run/dev-assets-middleware'
import { assets } from '@remix-run/assets-middleware'
import { files } from './files-config.ts'

let assetsMiddleware =
  process.env.NODE_ENV === 'production'
    ? assets({
        manifest: './build/assets-manifest.json',
        // No files config needed - just reads manifest!
      })
    : devAssets({
        files, // Dev needs files to generate on-demand
        allow: ['app/**'],
        filesCache: './.assets/files-cache',
      })

router.use(assetsMiddleware)
```

**Routes (with type safety):**

```ts
// routes/products.ts
function handler(context: RequestContext) {
  // Fully typed - IDE autocomplete!
  let shoeImage = context.assets.get('app/products/shoe.png', 'card')
  // → { href: '/app/products/shoe-card-abc123.png' }

  // Type errors for invalid usage:
  // context.assets.get('app/products/shoe.png', 'invalid') // ❌
  // context.assets.get('app/products/shoe.png')            // ❌ (variant required)
  // context.assets.get('app/icons/logo.svg', 'card')       // ❌ (no variants for SVGs)

  return html`<img src="${shoeImage.href}" alt="Shoe" />`
}
```

**Note:** Types for `context.assets` are inferred from the `files` config via module augmentation (implementation detail - users just get autocomplete automatically).

## How It Works

**Build time:**

1. Read `files` config with globs and transform functions
2. Scan filesystem for files matching globs
3. Generate all variants for each matched file
4. Write files with hashed names: `path-variant-hash.ext`
5. Write manifest (JSON) mapping sources → URLs

**Manifest format:**

```json
{
  "scripts": {
    "outputs": {
      "/app/entry-abc123.js": {
        "entryPoint": "app/entry.tsx",
        "imports": [{ "path": "/app/utils-def456.js", "kind": "import-statement" }]
      },
      "/app/utils-def456.js": {
        "entryPoint": "app/utils.ts"
      }
    }
  },
  "files": {
    "outputs": {
      "app/products/shoe.png": {
        "variants": {
          "thumbnail": { "path": "/app/products/shoe-thumbnail-ghi789.png" },
          "card": { "path": "/app/products/shoe-card-jkl012.png" },
          "hero": { "path": "/app/products/shoe-hero-mno345.png" }
        }
      },
      "app/icons/logo.svg": {
        "path": "/app/icons/logo-pqr678.svg"
      },
      "app/photos/hero.jpg": {
        "variants": {
          "optimized": { "path": "/app/photos/hero-optimized-stu901.jpg" },
          "thumbnail": { "path": "/app/photos/hero-thumbnail-vwx234.jpg" }
        },
        "default": "optimized"
      }
    }
  }
}
```

**Manifest structure:**

- `scripts`: Existing esbuild-style manifest (preserved as-is, nested under `scripts` key)
  - `outputs[outputPath]`: Build output files
  - `entryPoint`: Source file that generated this output
  - `imports`: Other chunks this output depends on (each has `path` and `kind`)
- `files`: New section for non-script assets (mirrors scripts structure)
  - `outputs[sourcePath]`: Maps source files to output(s)
  - With variants: `{ variants: { name: { path } }, default?: string }`
  - Transform only: `{ path: string }` (no variants property)
  - `default` field (optional): Which variant to use when no variant specified
  - Uses `path` for consistency with scripts section

**Production runtime:**

Simple manifest lookup - no config needed at all!

```ts
// Scripts (existing behavior, looks in manifest.scripts.outputs)
assets.get('app/entry.tsx')
// → Find output where entryPoint === 'app/entry.tsx'
// → Return { href: "/app/entry-abc123.js" }

// Files with variants
assets.get('app/products/shoe.png', 'card')
// → Lookup manifest.files.outputs["app/products/shoe.png"].variants["card"].path
// → Return { href: "/app/products/shoe-card-jkl012.png" }

// Files with transform only (no variants)
assets.get('app/icons/logo.svg')
// → Lookup manifest.files.outputs["app/icons/logo.svg"].path
// → Return { href: "/app/icons/logo-pqr678.svg" }

// Missing file
assets.get('app/missing.png', 'card')
// → Not in manifest.files.outputs
// → Return null (same as script behavior)
```

Production bundle doesn't include Sharp, transform functions, or any build-time code.

**Development runtime:**

Dev middleware needs `files` config to generate variants on-demand:

1. `assets.get('app/products/shoe.png', 'card')` is called
2. Match path against globs to find which rule applies (if no match, return null)
3. Check if requested variant exists in the rule (if not, return null)
4. Check cache - if exists, return hashed URL
5. If not cached: run transform, write to cache, return hashed URL
6. Cache persists across restarts (important for fast dev iteration)

Returns null for missing files or invalid variants (same as prod, same as scripts).

**Type safety:**

Types inferred from `files` config at compile time via module augmentation:

- Which files match which globs → available variants for each path
- Whether variant param is required, optional, or not allowed
- IDE autocomplete and type errors for invalid usage

**Transform execution:**

1. **Transform only:** Run transform with `{ sourcePath, ext }`, done
2. **Variants only:** Run selected variant with `{ sourcePath, ext }` from source file
3. **Both (pipeline):**
   - Run `transform` with `{ sourcePath: 'app/logo.png', ext: 'png' }`
   - If transform returns `{ data, ext: 'webp' }`, update ext
   - Pass output to `variant` with `{ sourcePath: 'app/logo.png', ext: 'webp' }`
   - Variant can further change ext if needed

**Context fields:**

- `sourcePath`: Always the original source file (never changes through pipeline)
- `ext`: Current extension (can be updated by transform/variant returning `{ data, ext }`)

## Implementation Phases

**Goal:** Prove the predefined variants approach works end-to-end with basic Sharp transforms.

**Scope:**

- `FilesConfig` type for files array
- Files structure with `transform` and `variants` fields
- Type inference using typed-glob (path → available variants)
- Module augmentation for `context.assets` (automatic)
- Basic Sharp transforms (simple resize variants)
- Parallel variant generation (table stakes for performance)
- Build fails on missing files or transform errors
- Filesystem cache for dev (`.assets/files-cache/`)
- Manifest generation for production
- Single middleware branch point (dev vs prod)

**Success criteria:**

1. Files config is simple TypeScript with normal imports
2. Types enforce correct variant usage (required vs optional vs none)
3. `build({ files, ... })` generates all variants and manifest
4. `devAssets({ files, ... })` generates variants on-demand and caches them
5. `assets({ manifest })` serves from manifest (no files config needed)
6. Both modes return hashed URLs with cache-forever headers
7. Demo shows image variants working in dev and prod

**Phase 2: Build Optimizations**

- Incremental builds (only regenerate changed sources)
- Better error messages for missing files or transform failures
- Progress reporting for large builds

**Phase 3: That's It**

The beauty of this approach is you don't need framework features:

- Want different transforms? Just use Sharp (or whatever) directly
- Want composition helpers? Write normal JavaScript functions
- Want CDN? Deploy your build output like any static assets
- Want custom caching? It's just files on disk

The framework gets out of your way.

## typed-glob Foundation (✅ Complete, Internal Module)

The typed-glob spike successfully proved type-level glob matching is viable. It now lives as an internal module under `packages/assets/src/lib/typed-glob`:

**Achievements:**

- Type-level glob parser and matcher (`ParseGlob`, `MatchGlob`)
- Support for: `*`, `**`, `?`, brace sets, character classes, extglobs, POSIX classes
- Minimatch parity testing infrastructure
- Good IDE autocomplete experience

**Key learnings:**

- Keep runtime glob matching as source of truth
- Limit typed support to documented subset (avoid excessive complexity)
- Dynamic paths fall back to broad/unknown types gracefully
- Parser-first architecture allows independent evolution

**Decision:** Use as foundation for assets type safety. Path literals → matching globs → available variant names. Keep the public internal boundary narrow via `typed-glob/index.ts`.

## Caching Strategy

**Simpler than before:** With predefined variants, caching is just static files.

**Development caching:**

- Location: `.assets/files-cache/` (gitignored via `.assets/`)
- Cache key: `hash(source content + variant name)`
- Persists across restarts (important for dev iteration)
- When file requested:
  1. Check if cached → serve with hashed URL
  2. If not → transform, write to cache, serve

**Production caching:**

- All variants pre-generated during build
- Written to `build/assets/` with hashed filenames
- Manifest maps `(path + variant) → hashed filename`
- No runtime transformation (except optional CDN/edge transforms)

**Cache invalidation:**

- Source file changes → new content hash → new cache entry
- Variant definition changes → rebuild required
- Simple, predictable, standard

## Phase 1: MVP Detailed Scope

**IN SCOPE:**

**Files Config:**

- `FilesConfig` type for the files array structure
- Glob patterns for matching files
- `transform` field (optional): Base transformation for all matching files
- `variants` field (optional): Named variant transformations
- `defaultVariant` field (optional): Makes variant param optional at runtime
- Transform function signature:
  - Simple: `(data: Buffer) => Buffer`
  - Advanced: `(data: Buffer, { sourcePath, ext }) => Buffer | { data: Buffer, ext?: string }`
  - Enables path-dependent logic and format conversion
- Normal imports (Sharp, etc.) - only runs at build/dev time

**Type Safety:**

- `FilesConfig` type for sharing between build and dev
- Module augmentation for `context.assets` (implementation detail)
- typed-glob integration: path literal → matching glob → variant names
- Types enforce:
  - Variant param required when `variants` defined (unless `defaultVariant` set)
  - Variant param not allowed when only `transform` defined
  - Only valid variant names accepted

**Build:**

- `build({ files, scripts, outDir, manifest })` function
- Scans filesystem for files matching globs
- Generates all variants for each file
- Writes files with hashed names: `path-variant-hash.ext`
- Writes manifest mapping `(path + variant) → hashed URL`

**Middleware:**

- Single branch point: `devAssets()` vs `assets()`
- Different params for each mode
- Both provide `context.assets` with identical API
- **Dev mode:**
  - `devAssets({ files, allow, filesCache })`
  - Reads files config directly
  - Generates variants on-demand
  - Caches to `.assets/files-cache/` (persists across restarts)
  - Returns hashed URLs for cached variants
- **Prod mode:**
  - `assets({ manifest })`
  - Just reads manifest (no files config needed!)
  - Looks up hashed URLs
  - No runtime transformation

**Transforms:**

- Simple Sharp-based resize for MVP
- Limited params to prove the concept
- Example variants: thumbnail (100px), card (400px), hero (1200px)

**Demo:**

- Use assets demo app
- Add product images with multiple variants
- Route showing different variant sizes
- Verify dev and prod modes work identically

**SUCCESS CRITERIA:**

1. **Files config is simple TypeScript:**

   ```ts
   import type { FilesConfig } from '@remix-run/assets'
   import sharp from 'sharp'

   const files: FilesConfig = [
     {
       include: 'app/**/*.png',
       variants: {
         small: (data) => sharp(data).resize(200).toBuffer(),
         large: (data) => sharp(data).resize(1200).toBuffer(),
         webp: (data) => ({
           data: sharp(data).webp({ quality: 85 }).toBuffer(),
           ext: 'webp',
         }),
       },
     },
   ]
   ```

2. **Types enforce correct usage:**

   ```ts
   assets.get('app/logo.png', 'small') // ✅ returns asset URL
   assets.get('app/logo.png') // ❌ type error: variant required
   assets.get('app/logo.png', 'medium') // ❌ type error: invalid variant

   // Runtime: returns null for missing files/variants (type-safe with literals, but dynamic strings could fail)
   assets.get('app/missing.png', 'small') // → null
   ```

3. **Build generates all variants:**

   ```ts
   await build({ files, outDir: './build/assets', manifest: './manifest.json' })
   ```

   - Scans filesystem for files matching globs
   - Generates all variants
   - Writes hashed files and manifest

4. **Dev generates on-demand:**

   ```ts
   devAssets({ files, allow: ['app/**'], filesCache: './.assets/files-cache' })
   ```

   - First request: transforms, caches, returns hashed URL
   - Second request: serves from cache
   - Cache persists across restarts

5. **Prod serves from manifest (no config needed):**

   ```ts
   assets({ manifest: './build/assets-manifest.json' })
   ```

   - No transformation at runtime
   - Simple manifest lookup
   - Returns pre-generated hashed URLs
   - Doesn't bundle Sharp or transform functions

6. **Demo works in both modes:**

   - Images display correctly
   - URLs are hashed
   - Cache headers are correct (immutable)

7. **Null handling:**
   - Returns null for missing files (consistent with scripts)
   - Returns null for invalid variants
   - Same behavior in dev and prod

**TEST APPROACH:**

- **Unit tests:**
  - Config type inference
  - Glob matching logic
  - Variant selection logic
- **Integration tests:**
  - Build generates correct files
  - Manifest structure is correct
  - Dev middleware caching works
  - Prod middleware manifest lookup works
- **Type tests:**
  - Module augmentation works
  - typed-glob inference works
  - Invalid variants cause type errors
- **Manual demo testing:**
  - Build assets
  - Run dev server, verify variants work
  - Build prod, run prod server, verify variants work
  - Restart dev server, verify cache persists

## Next Steps

1. **Manual demo validation (remaining):**

   - Verify assets demo in dev mode (`devAssets`) end-to-end
   - Verify assets demo in prod mode (`assets` + manifest) end-to-end
   - Confirm variant URLs, cache behavior, and parity between modes

2. **Task cleanup:**
   - Move this task to `done/` after manual validation passes
   - Keep notes focused on the predefined variants approach + internal typed-glob boundary

## Key Decisions Made

1. ✅ **Predefined variants only** - No runtime params (eliminates security, validation, registry complexity)
2. ✅ **Glob-based rules** - Config changes rare, adding files doesn't require config changes
3. ✅ **Simple transform functions** - `(data, context?) => Buffer | { data, ext? }`, composition via JavaScript
4. ✅ **Format conversion built-in** - Return `{ data, ext }` to change output format (png → webp, etc.)
5. ✅ **Path-aware transforms** - Optional context param provides `sourcePath` and `ext` for advanced logic
6. ✅ **No magic names** - Explicit `defaultVariant` option instead of reserved variant names
7. ✅ **Prod needs zero config** - Just reads manifest, no transform code bundled
8. ✅ **FilesConfig type only** - No special "assetsConfig" concept, just function params
9. ✅ **Normal TypeScript** - Regular imports, runs at build/dev time only
10. ✅ **typed-glob for types (internalized)** - Compile-time path → variant name inference

## References

- `packages/assets/src/lib/typed-glob` - Internal type-level glob matching foundation
- `@remix-run/route-pattern` - Type parsing patterns
- minimatch - Runtime glob matching reference
- Sharp - Image transformation library
