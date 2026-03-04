# File Cache Plan

## Background

The `@remix-run/files` package (and its `createFilesHandler`/`createFilesRoute` APIs) was modelled after a bundler-era concept: a static asset pipeline with pre-declared variants. On reflection, this conflates several concerns that are better handled by composing existing Remix primitives:

- **Serving files as-is** → `staticFiles` middleware or `createFileResponse`
- **Storing/retrieving files** → `FileStorage` (`createFsFileStorage`, etc.)
- **Transforming files and caching the results** → a new `createFileCache` primitive (this plan)

The result is simpler, more explicit code that also unlocks capabilities the old system couldn't support — like truly dynamic transform parameters (e.g. `?width=400&height=300`).

---

## New package: `@remix-run/file-cache`

### Purpose

Content-addressed caching for expensive `File → File` computations (e.g. image resizing). Backed by any `FileStorage` implementation, with optional LRU eviction and warm cold-start support via a user-supplied `version`.

### API

```ts
import { createFileCache } from 'remix/file-cache'
import { createFsFileStorage } from 'remix/file-storage/fs'

let cache = createFileCache(createFsFileStorage('./tmp/cache'), {
  maxSize: 100 * 1024 * 1024, // optional, enables LRU eviction (bytes)
  version: 'v1', // optional, defaults to crypto.randomUUID()
})
```

#### `cache.getOrSet(key, factory)`

```ts
let result = await cache.getOrSet([sourceFile, 'thumbnail'], () => transform(sourceFile))
```

#### `cache.get(key)` / `cache.set(key, value)`

Lower-level escape hatch when you need to separate the lookup from the compute.

```ts
let cached = await cache.get([sourceFile, 'thumbnail'])
if (!cached) {
  let output = await transform(sourceFile)
  await cache.set([sourceFile, 'thumbnail'], output)
  return output
}
return cached
```

#### `cache.prune()`

Removes all entries from _other_ versions. Recommended at startup in all cases to prevent orphaned directories accumulating on disk.

```ts
await cache.prune()
```

#### `cache.clear()`

Removes all entries from the _current_ version. Useful for testing and emergency cache-busting without bumping `version`.

```ts
await cache.clear()
```

### Cache key semantics

```ts
type CacheableArg = File | string | number | boolean | null
type CacheKey = CacheableArg | CacheableArg[]
```

- **`File` / `LazyFile`** — fingerprinted by `size:lastModified` (metadata only, no byte reading)
- **Primitives** — serialized verbatim into the fingerprint
- **`version`** — mixed into every fingerprint automatically

The internal fingerprint is computed using the Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`), consistent with Remix's runtime-agnostic approach — no `node:crypto` dependency.

### Storage layout

Cache entries are nested under the `version` as a key prefix:

```
<storage root>/
  v1/
    <fingerprint>
    <fingerprint>
  v2/                        ← previous version, now orphaned
    <fingerprint>
  a3f9bc12-.../              ← random UUID version (default), one per process start
    <fingerprint>
```

This makes pruning trivial — anything not under the current version prefix is orphaned.

### Cold starts and warm restarts

By default, `version` is `crypto.randomUUID()` evaluated at construction time. This means every process start produces different fingerprints — all storage lookups miss, and the cache fills up organically during the process lifetime. This is safe: no stale outputs, bounded cost of one transform per unique input per process lifetime.

To opt into warm cold starts, provide a stable `version` string. On cold start, fingerprints will match existing storage entries. Bump `version` whenever transform logic changes to prevent stale outputs.

### Pruning

Every process start orphans the previous version's entries — either because the random default `version` changed, or because you bumped a stable version string. Without pruning, orphaned directories accumulate on disk indefinitely.

`cache.prune()` removes all entries not under the current version prefix. **Calling it at startup is recommended in all cases:**

```ts
let cache = createFileCache(createFsFileStorage('./tmp/cache'), { version: 'v1' })
await cache.prune() // remove all entries not under 'v1/'
```

The only reason to skip `prune()` at startup is if you're intentionally running multiple processes with different versions simultaneously (e.g. blue/green deployments) and need both caches to remain intact.

### LRU eviction

When `maxSize` is set, the cache enforces a total size limit across all entries under the current version prefix (computed via `storage.list({ prefix: version, includeMetadata: true })`). Least-recently-used entries are evicted when the limit is exceeded. This is essential for dynamic transform parameters (e.g. arbitrary `?width=` values) where the keyspace is unbounded.

Without `maxSize`, the cache grows indefinitely within the current version — suitable only for fixed variant sets with a bounded number of source files.

### Integration with `lazy-file`

`LazyFile` keys are fingerprinted using only metadata (`size`, `lastModified`) — bytes are never read during cache lookup. Bytes are only read by the factory function itself on a cache miss. The result stored in `FileStorage` is itself a `LazyFile`, so cache hits stream directly to the response without loading into memory.

### Package location

`packages/file-cache/` — its own package, not merged into `file-storage`. The concerns are distinct: `file-storage` is a key/value interface for storing `File` objects; `file-cache` adds fingerprinting, LRU eviction, and getOrSet semantics for computed outputs.

---

## Update `demos/assets-reboot`

### Remove

- `createFilesRoute` export from `routes.ts`
- `createFilesHandler` usage in `server.ts`
- `@remix-run/files` dependency

### Add

- `createFileCache` with `createFsFileStorage` backing
- A `/images/*path` route handler that uses `openLazyFile` + `cache.getOrSet`
- `createFileResponse` for the HTTP response (ETags, Range, 304)

### Before

```ts
// routes.ts
export const files = createFilesRoute('/files', {
  rules: [
    {
      include: 'app/images/**',
      variants: ['thumbnail', 'card', 'hero'] as const,
      defaultVariant: 'card',
    },
  ],
})

// server.ts
let filesHandler = createFilesHandler(files, {
  root: import.meta.dirname,
  rules: [
    {
      include: 'app/images/**',
      variants: {
        thumbnail: (data) => ({
          data: sharp(data).resize(120).jpeg({ quality: 55 }).toBuffer(),
          ext: 'jpg',
        }),
        card: (data) => ({
          data: sharp(data).resize(280).jpeg({ quality: 62 }).toBuffer(),
          ext: 'jpg',
        }),
        hero: (data) => ({
          data: sharp(data).resize(560).jpeg({ quality: 72 }).toBuffer(),
          ext: 'jpg',
        }),
      },
      defaultVariant: 'card',
    },
  ],
})
```

### After

```ts
// routes.ts — deleted entirely (scripts simplification plan handles scripts separately)

// server.ts
import { openLazyFile } from 'remix/fs'
import { createFileCache } from 'remix/file-cache'
import { createFsFileStorage } from 'remix/file-storage/fs'
import { createFileResponse } from 'remix/response'

let imageCache = createFileCache(createFsFileStorage('./tmp/image-cache'), {
  maxSize: 100 * 1024 * 1024,
})

let variants = {
  thumbnail: async (file: File) => {
    let buf = await sharp(await file.arrayBuffer())
      .resize(120)
      .jpeg({ quality: 55, mozjpeg: true })
      .toBuffer()
    return new File([new Uint8Array(buf)], 'output.jpg', { type: 'image/jpeg' })
  },
  card: async (file: File) => {
    let buf = await sharp(await file.arrayBuffer())
      .resize(280)
      .jpeg({ quality: 62, mozjpeg: true })
      .toBuffer()
    return new File([new Uint8Array(buf)], 'output.jpg', { type: 'image/jpeg' })
  },
  hero: async (file: File) => {
    let buf = await sharp(await file.arrayBuffer())
      .resize(560)
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer()
    return new File([new Uint8Array(buf)], 'output.jpg', { type: 'image/jpeg' })
  },
}

router.get('/images/*path', async ({ request, params }) => {
  let filePath = path.join(import.meta.dirname, 'app/images', params.path)
  let sourceFile = openLazyFile(filePath)

  let variant = (new URL(request.url).searchParams.get('variant') ??
    'card') as keyof typeof variants
  if (!(variant in variants)) return new Response('Unknown variant', { status: 400 })

  let result = await imageCache.getOrSet([sourceFile, variant], () => variants[variant](sourceFile))

  return createFileResponse(request, result)
})
```

### URL shape change

| Before                                                                                                          | After                                       |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `files.href('app/images/books/bbq-1.png', 'thumbnail')` → `/files/app/images/books/bbq-1.png?variant=thumbnail` | `/images/books/bbq-1.png?variant=thumbnail` |

Image routes now live in the main route tree alongside all other application routes. URL generation uses the same standard route pattern mechanism as every other route — no special `files.href()`. Combined with the scripts simplification plan, `routes.ts` / `asset-routes.ts` are deleted entirely: scripts, images, and uploads join `app/routes.ts` as first-class routes.

---

## Update `demos/bookstore`

### Remove

- `asset-routes.ts` entirely (combined with scripts simplification plan, nothing remains)
- `createFilesHandler` imports and usage from `app/router.ts`
- `imagesMiddleware` and `uploadsMiddleware` from `app/router.ts`
- `@remix-run/files` dependency

### Add

- `createFileCache` with `createFsFileStorage` backing (shared between images and uploads)
- `/images/*path` route — source from filesystem via `openLazyFile`
- `/uploads/*path` route — source from `uploadsStorage.get(key)` (returns `LazyFile`)
- `createFileResponse` for both routes

### After

Images and uploads join the main route tree in `app/routes.ts` alongside all other application routes:

```ts
// app/routes.ts
export let routes = {
  // ... existing routes unchanged ...
  images: '/images/*path',
  uploads: '/uploads/*path',
}
```

Mounted in `app/router.ts` like any other route:

```ts
import { openLazyFile } from 'remix/fs'
import { createFileCache } from 'remix/file-cache'
import { createFsFileStorage } from 'remix/file-storage/fs'
import { createFileResponse } from 'remix/response'

let imageCache = createFileCache(createFsFileStorage(path.join(root, 'tmp/image-cache')), {
  maxSize: 200 * 1024 * 1024,
})

let imageVariants = {
  thumbnail: async (file: File) => {
    let buf = await sharp(await file.arrayBuffer())
      .resize(120)
      .jpeg({ quality: 55, mozjpeg: true })
      .toBuffer()
    return new File([new Uint8Array(buf)], 'output.jpg', { type: 'image/jpeg' })
  },
  card: async (file: File) => {
    let buf = await sharp(await file.arrayBuffer())
      .resize(280)
      .jpeg({ quality: 62, mozjpeg: true })
      .toBuffer()
    return new File([new Uint8Array(buf)], 'output.jpg', { type: 'image/jpeg' })
  },
  large: async (file: File) => {
    let buf = await sharp(await file.arrayBuffer())
      .resize(560)
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer()
    return new File([new Uint8Array(buf)], 'output.jpg', { type: 'image/jpeg' })
  },
}

router.get(routes.images, async ({ request, params }) => {
  let filePath = path.join(root, 'app/images', params.path)
  let sourceFile = openLazyFile(filePath)

  let variant = (new URL(request.url).searchParams.get('variant') ??
    'card') as keyof typeof imageVariants
  if (!(variant in imageVariants)) return new Response('Unknown variant', { status: 400 })

  let result = await imageCache.getOrSet([sourceFile, variant], () =>
    imageVariants[variant](sourceFile),
  )

  return createFileResponse(request, result)
})

router.get(routes.uploads, async ({ request, params }) => {
  let sourceFile = await uploadsStorage.get(params.path)
  if (!sourceFile) return new Response('Not found', { status: 404 })

  let variant = (new URL(request.url).searchParams.get('variant') ??
    'card') as keyof typeof imageVariants
  if (!(variant in imageVariants)) return new Response('Unknown variant', { status: 400 })

  let result = await imageCache.getOrSet([sourceFile, variant], () =>
    imageVariants[variant](sourceFile),
  )

  return createFileResponse(request, result)
})
```

The uploads route reads from `uploadsStorage` (the same `FileStorage` used by `uploadHandler`) and passes the resulting `LazyFile` into the shared `imageCache`. No special handling needed — `LazyFile` from storage works as a cache key exactly like `openLazyFile` from the filesystem.

---

## Order of work

1. Create `packages/file-cache` with `createFileCache` implementation
2. Add `file-cache` export to `packages/remix`
3. Update `demos/assets-reboot` — remove `files` route, add image route handler
4. Update `demos/bookstore` — remove files handler, add image/uploads route handlers
5. Delete `packages/files` (pending sign-off — keep for now as reference)
