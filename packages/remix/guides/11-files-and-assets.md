---
title: Files and Assets
description: How Remix serves static files and source assets, accepts bounded uploads, stores files, and returns HTTP file responses.
---

This chapter is unfinished. The sections below outline what it will cover. For working API examples, see the [`remix/assets`](../src/assets/README.md), [`remix/middleware/form-data`](../src/form-data-middleware/README.md), [`remix/file-storage`](../src/file-storage/README.md), and [`remix/response/file`](../src/response/README.md) overviews.

Remix serves files through three paths. Choose the path before configuring caches or storage:

| Where the file lives                                  | What serves it                                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Root `public/`, served exactly as it is               | `staticFiles()` from [`remix/middleware/static`](../src/static-middleware/README.md)                                             |
| `app/**/public/`, browser source that needs compiling | `createAssetServer()` from [`remix/assets`](../src/assets/README.md)                                                             |
| User uploads                                          | `formData()` from [`remix/middleware/form-data`](../src/form-data-middleware/README.md), then storage and `createFileResponse()` |

## Serve files as-is with staticFiles()

`staticFiles()` from [`remix/middleware/static`](../src/static-middleware/README.md) answers `GET` and `HEAD` requests for files under the directory you pass it, such as `./public` for a favicon or `robots.txt`. Requests for missing files fall through to the router. Cover `index: false` as used by the template, `filter` for hiding files, cache options shared with `createFileResponse()`, and multiple directories.

## Serve browser source with the asset server

Walk through the template's asset server:

```ts filename=app/assets.ts
import { createAssetServer } from "remix/assets";

export const assets = createAssetServer({
  basePath: "/assets",
  rootDir: process.cwd(),
  allowFiles: ["app/routes.ts", "app/**/public/**"],
  allowPackages: ["remix"],
  denyFiles: ["app/**/*.test.*"],
});
```

Map `/assets/*path` to an action that calls `assets.fetch(request)`. It resolves to `null` when the request doesn't match a servable asset, so the action returns its own `404`. Pass the same server to `render({ assets })` from [`remix/middleware/render`](../src/render-middleware/README.md) so client entries resolve to asset URLs. Explain the default mounts: `app` is served beneath `/assets/app` and `node_modules` beneath `/assets/npm`, preserving the path below each directory.

## Control what the browser can reach

Treat `allowFiles`, `allowPackages`, and `denyFiles` as a security boundary, not merely compilation configuration. Put browser source in colocated `public/` directories beside its narrowest owner, keep its local dependencies inside the same directory, and explain why `app/routes.ts` is allowed separately for type-safe hrefs.

For npm packages:

- List each package used by browser code in `allowPackages`. Its dependencies are allowed automatically, but peer dependencies must be listed explicitly.
- Only ES modules can be served. CommonJS packages are rejected.
- Use `scripts.external` to leave specific import specifiers untouched.

When an asset doesn't load, run `remix assets` to list browser-reachable files and `remix assets inspect <url-or-file>` to see one mapping and its access decision. Explain the compilation errors readers will hit, such as `IMPORT_NOT_ALLOWED`, `IMPORT_OUTSIDE_MOUNTS`, and `IMPORT_NOT_SUPPORTED`. [CLI and Tooling](/cli-and-tooling/) covers sharing this configuration through `remix.json`.

## Load browser scripts

Use `getScriptEntry()` for rendered script entries because scripts need a public URL, modulepreload hints, and an import map. Resolve stable root entry metadata once in `app/assets.ts`:

```ts filename=app/assets.ts
const entry = "app/actions/public/entry.ts";

export const scriptEntry = await assets.getScriptEntry(entry);
```

Render the import map with `<ImportMap>` from [`remix/component/server`](../src/component/server/README.md) before the modulepreload links and module script. It combines the entry's mappings with import maps from blocking client entries, and frame responses can add more. When targeting browsers without native support for multiple import maps, use [`remix/multiple-import-maps-polyfill`](../src/multiple-import-maps-polyfill/README.md) as shown in [Interactivity](/interactivity/#browser-entry-with-run).

Close with one short paragraph on barrel files: named imports through eligible barrel files are rewritten to their implementation modules when every removed module is declared side-effect-free in its `package.json`.

## Reference styles, images, and fonts

Browser modules can only import scripts, so CSS and images are referenced by URL. `getHref()` runs on the server, so resolve URLs in an action or middleware and pass them to components as props. It accepts a `file://` URL, which pairs well with `new URL("./public/cover.svg", import.meta.url)`.

Cover `<link rel="stylesheet">` for stylesheet assets, font preloads, and `files.extensions` for serving leaf files such as images and fonts. Relative CSS `@import` and `url()` references are rewritten to asset URLs.

## Transform images and other files

Define request-selected transforms with `defineFileTransform()`, including transforms that take a parameter, and request them with `getHref(path, { transform })` or `?transform=` in hand-written URLs. Cover global transforms that run for every matching file and `maxRequestTransforms`.

Transformed outputs are recomputed per request unless you configure `files.cache`. Use `createFsFileCache()` for the built-in disk cache and set `files.cacheKey` to a stable value such as a commit SHA to reuse outputs across restarts.

## Hot reloading in development

The template's `dev` script restarts the server process with Node's `--watch`, and its asset server sets `watch: isDevelopment` so browser source changes are recompiled without a restart. Its `hmr` script runs the app through [`remix/node-hmr`](../src/node-hmr/README.md) instead, with the asset server's `hmr` option using `createBrowserHmrChannel()` from [`remix/node-hmr/runtime`](../src/node-hmr/README.md) and `componentHmr()` from [`remix/component-hmr/assets`](../src/component-hmr/README.md) as a script loader.

Cover the basics of `import.meta.hot` (`accept()`, `dispose()`, `invalidate()`), typing it with [`remix/assets/types/hmr`](../src/assets/README.md), and the `server:update` event the template's browser entry uses to reload the top frame.

## Production asset settings

In production, the template disables watching, enables minification, and sets `fingerprint: isProduction` so assets get content-based URLs with long-lived immutable caching. Its shutdown handler calls `assets.close()` after the HTTP server closes. Cover `target`, `sourceMaps`, `scripts.define` for values like `process.env.NODE_ENV`, and the asset server's `onError`.

There is no build step: assets compile on first request and are cached in memory. [Production](/production/) covers cache policy and compression.

## Accept file uploads

Forms that upload files need `enctype="multipart/form-data"` and an `<input type="file">`, optionally with `accept` and `multiple`. Put `formData()` from [`remix/middleware/form-data`](../src/form-data-middleware/README.md) on the upload action instead of the whole router so other requests skip multipart parsing.

The middleware parses the body once and passes each file to your `uploadHandler`, which stores it under a server-generated key and returns that key as the form value. The stable parser reads each file into memory before calling the handler. Set `maxFileSize` (default 2 MiB), `maxFiles` (default 20), `maxParts` (default 1000), `maxTotalSize`, and `maxHeaderSize`, then turn limit errors from [`remix/form-data-parser`](../src/form-data-parser/README.md) into `400` or `413` responses.

To avoid buffering large uploads in memory, try `formData()` from [`remix/middleware/form-data/future`](../src/form-data-middleware/README.md). It takes the same options, but each upload streams from the request body and must be read inside `uploadHandler`, for example by passing it to `storage.set()`. Future entrypoints are not stable and may change in any release.

## Validate uploads

The upload handler stores each file before your action runs, so:

- When the handler returns a storage key, the parsed form contains a string. Validate it with `f.field()`, not `f.file()`, from [`remix/data-schema/form-data`](../src/data-schema/README.md).
- Treat the submitted file name and type as untrusted. Never use the name as a path, and don't derive the stored extension from it.
- Remove stored files when the rest of the form fails validation.
- Run authentication and [`remix/middleware/cop`](../src/cop-middleware/README.md) before `formData()` so unauthorized requests are rejected before their files are stored.

## Store files

Use the `FileStorage` API from [`remix/file-storage`](../src/file-storage/README.md): `get()`, `set()`, `has()`, `list()`, `put()`, and `remove()`. Use [`remix/file-storage/memory`](../src/file-storage/README.md) in tests, [`remix/file-storage/fs`](../src/file-storage/README.md) for a single server, and [`remix/file-storage/s3`](../src/file-storage-s3/README.md) for AWS S3 or S3-compatible providers.

For S3, use `set()` for large files because `put()` holds the whole file in memory, set `endpoint` and `forcePathStyle` for MinIO or LocalStack, and add a lifecycle rule that removes incomplete multipart uploads. [Production](/production/#process-safe-storage) covers storage shared across replicas.

## Send stored and on-disk files

Serve uploads from a route that checks authorization, calls `storage.get(key)`, and returns `createFileResponse()` from [`remix/response/file`](../src/response/README.md). `staticFiles()` can't serve the storage directory because the filesystem backend stores files under hashed names. Choose private or public caching per route, and either serve uploads as downloads with `Content-Disposition: attachment` or validate their contents before serving HTML or SVG inline.

For files on disk, use `openLazyFile()` from [`remix/fs`](../src/fs/README.md), which detects the media type from the file extension. Register unknown extensions with `defineMimeType()` from [`remix/mime`](../src/mime/README.md) and build download headers with `ContentDisposition` from [`remix/headers`](../src/headers/README.md). `createFileResponse()` handles content length, ETags, conditional requests, `HEAD`, and ranges, and only enables ranges for non-compressible types so [`remix/middleware/compression`](../src/compression-middleware/README.md) can still compress text.

For custom part processing or non-form multipart formats, use [`remix/multipart-parser`](../src/multipart-parser/README.md) directly. [`remix/tar-parser`](../src/tar-parser/README.md) reads tar archives as streams.
