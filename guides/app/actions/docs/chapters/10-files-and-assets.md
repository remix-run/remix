---
title: Files and Assets
description: How Remix serves static files and source assets, accepts bounded uploads, stores files, and returns HTTP file responses.
---

Remix has separate paths for files that already exist in public form, browser source that needs compilation, and user uploads that must cross a trust boundary. Choose that path before configuring caches or storage.

## Static files and source-served assets {#static-files-vs-source-served-assets}

Use `staticFiles()` for files served from disk as-is. Use `createAssetServer()` for TypeScript, JavaScript, CSS, images, or fonts that need import rewriting, compilation, transforms, preloads, or fingerprinted URLs.

## Configure the asset server boundary {#remix-s-unbundled-asset-server}

Define `rootDir`, the public `basePath`, and a `fileMap` from URL patterns to root-relative source patterns. Use `allowFiles` for app-owned source, `allowPackages` for dependencies that should be served by package name, and `denyFiles` for server-only modules that need to override an allow rule, then map the asset namespace to a controller action that calls `assetServer.fetch(request)`.

## Browser modules, CSS, and file assets {#browser-modules-asset-roots-and-package-mounts}

Explain on-demand TypeScript/JavaScript compilation, rewritten imports, CSS `@import` and `url()` references, package mounts, and configured leaf-file extensions. Keep browser-owned code in an allowed app directory rather than exposing the full source tree.

## Asset hrefs, client entries, and preloads {#client-entry-hrefs-and-module-preloads}

Use `getHref()` for scripts, styles, and files, and `getPreloads()` for entry dependencies. Resolve `clientEntry(import.meta.url, ...)` IDs through the asset server in the shared renderer instead of hard-coding deployment URLs in components.

## File transforms and transformed-output caches {#asset-file-transforms}

Define request-selected transforms with `defineFileTransform()`, optional global transforms, extension constraints, and request pipeline limits. Use a `FileStorage` cache when transformed output should survive repeated requests or process restarts for the same build.

## Development watching and production fingerprints {#fingerprinting-source-maps-minification}

Choose one development watcher. A long-lived asset server may watch source files itself, while the generated app sets `watch: false` and lets Node's `--watch` restart the process. Close asset-owned watchers during shutdown. In production, disable watching, choose browser targets, source-map and minification policy, and enable fingerprinting with a build ID that changes on every deploy.

## Parse bounded form uploads {#file-uploads}

Configure `formData({ uploadHandler, ...limits })` to parse multipart bodies once and stream file parts to storage. Set limits for headers, files, individual file size, part count, and total size, then translate known parser or storage failures into useful `400` or `413` responses.

## Store files by app-owned keys {#file-storage-memory-filesystem-s3}

Use the common `FileStorage` API with memory, filesystem, or S3-compatible backends. Generate storage keys on the server, validate media type and size, keep original names as metadata rather than trusted paths, and authorize both writes and reads.

## Use the low-level multipart parser only when needed {#multipart-parsing}

`remix/form-data-parser` is the normal streaming upload layer. Reach for `remix/multipart-parser` directly for non-form multipart formats, runtime-specific streams, or custom part processing, and preserve its header, part, and aggregate limits.

## Stream downloads with correct HTTP semantics {#file-downloads-lazy-files-mime-types-and-range-responses}

Open filesystem data as a `LazyFile` or read it from `FileStorage`, then use `createFileResponse()` for content length, MIME type, ETags, conditional requests, HEAD, and ranges. Add `Content-Disposition` for downloads, use `remix/mime` for content types, and avoid buffering large files into native `File` objects.
