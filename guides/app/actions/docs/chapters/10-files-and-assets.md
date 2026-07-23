---
title: Files and Assets
description: How Remix serves static files and source assets, accepts bounded uploads, stores files, and returns HTTP file responses.
---

Our record store has three kinds of files now. The favicon is already public and needs no compilation. The browser entry and its imports are source files that Remix compiles on demand. Album covers arrive from untrusted users and must be bounded, authorized, stored, and served deliberately.

Those files should not share one catch-all directory. Each kind has a different trust boundary and cache policy.

## Static files and source-served assets {#static-files-vs-source-served-assets}

The generated app keeps `staticFiles()` at the front of the cumulative middleware stack:

```ts filename=app/router.ts
import { staticFiles } from "remix/middleware/static";
import { createRouter } from "remix/router";

// Keep this entry first in the existing createRouter options:
createRouter({
  middleware: [
    staticFiles("./public", { index: false }),
    // remaining cumulative middleware...
  ],
});
```

A file such as `public/placeholder-cover.jpg` is available at `/placeholder-cover.jpg` byte for byte. This is the right path for a favicon, `robots.txt`, or another checked-in file that already has its public representation.

Browser source is different. A TypeScript entry imports components, CSS, and package code that the browser cannot load directly from the server's filesystem. `createAssetServer()` exposes an explicit source boundary and compiles requested modules on demand.

Keep user uploads out of both paths. An upload is not a trusted public asset merely because it is an image. Store it behind an app-owned key and serve it through an action that can apply authorization and response headers.

## Configure the asset server boundary {#remix-s-unbundled-asset-server}

The generated asset server allows browser-owned app modules and the `remix` package:

```ts filename=app/assets.ts
import { createAssetServer } from "remix/assets";

let isDevelopment = (process.env.NODE_ENV ?? "development") === "development";

export const assetServer = createAssetServer({
  basePath: "/assets",
  rootDir: process.cwd(),
  fileMap: {
    "app/*path": "app/*path",
    "node_modules/*path": "node_modules/*path",
  },
  allowFiles: ["app/assets/**"],
  allowPackages: ["remix"],
  denyFiles: ["app/**/*.server.*"],
  sourceMaps: isDevelopment ? "external" : undefined,
  minify: !isDevelopment,
  watch: false,
});
```

`basePath` owns the public URL namespace. The `fileMap` patterns translate paths inside that namespace back to files under `rootDir`; named parameters must match on both sides. An asset request still has to pass the allow rules. `denyFiles` wins over `allowFiles` and `allowPackages`, so a server-only module stays private even if a broader rule would otherwise include it.

Package rules use exact package names. Dependencies and installed optional dependencies of an allowed package are included, but peer dependencies are not. Add a peer explicitly only when browser source really imports it.

The generated root controller already owns `/assets/*path`. Update that existing action if its asset-server configuration changed; do not add a second import or a duplicate `assets` property:

```ts filename=app/actions/controller.tsx
import { assetServer } from "../assets.ts";

// Keep this method in the existing actions object:
async assets(context) {
  return (
    (await assetServer.fetch(context.request)) ?? new Response("Not found", { status: 404 })
  );
},
```

`fetch()` returns `null` when it does not handle the request, including missing or disallowed files. Let the route return its normal `404`; never substitute an unrestricted filesystem read.

## Browser modules, CSS, and file assets {#browser-modules-asset-roots-and-package-mounts}

Put browser-loadable source under the allowed directory. The generated client entry is `app/assets/entry.ts`:

```ts filename=app/assets/entry.ts
import type { FrameContent } from "remix/ui";
import { run } from "remix/ui";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl);
    return module[exportName];
  },
  async resolveFrame(src, signal, target): Promise<FrameContent> {
    let url = new URL(src, window.location.href);
    if (url.origin !== window.location.origin) {
      throw new Error("Refusing to render a cross-origin frame");
    }

    let headers = new Headers({
      Accept: "text/html",
      "X-Remix-Frame": "true",
    });
    if (target) headers.set("X-Remix-Target", target);

    let response = await fetch(url, { headers, signal });
    let responseUrl = new URL(response.url || url.href);
    if (responseUrl.origin !== window.location.origin) {
      throw new Error("Refusing to render a cross-origin frame redirect");
    }

    if (response.status === 401) {
      let location = response.headers.get("X-Login-Location");
      if (location === null) {
        throw new Error(
          "Frame authentication response is missing a login location",
        );
      }

      let loginUrl = new URL(location, responseUrl);
      if (loginUrl.origin !== window.location.origin) {
        throw new Error("Refusing a cross-origin login location");
      }

      window.location.assign(loginUrl.href);
      return "<p>Redirecting to sign in…</p>";
    }

    if (!response.ok) {
      return '<p role="alert">Could not load this section. Reload the page to try again.</p>';
    }
    return response.body ?? response.text();
  },
});

app.addEventListener("error", (event) => {
  console.error("Remix UI error:", event.error);
});

await app.ready();
```

This keeps the frame target and authentication contract introduced earlier. A `401` may navigate only to the same-origin login location supplied by `requireUser`; other non-success responses stay inside the frame as fixed app-owned HTML. The next chapter turns those branches into an explicit error policy.

When the browser requests that entry, the asset server compiles TypeScript and JavaScript, rewrites imports to public asset URLs, and serves imported package modules through their configured mount. CSS imports and CSS `@import` and `url()` references are rewritten through the same boundary.

Leaf files such as images and fonts need an allowed extension:

```ts filename=app/assets.ts
// inside createAssetServer({ ... }):
files: {
  extensions: [".svg", ".png", ".jpg", ".woff2"],
},
```

Extensions include the leading dot. JavaScript, TypeScript, CSS, and source-map extensions are owned by the compiler and cannot be added as leaf-file extensions.

The important boundary is the allow list, not a filename suffix. Keeping browser-owned code under `app/assets/` makes that boundary visible and avoids exposing the rest of `app/` merely to load one client component.

## Asset hrefs, client entries, and preloads {#client-entry-hrefs-and-module-preloads}

Use `getHref()` when server code needs the public URL for a source file:

```ts
let entryHref = await assetServer.getHref("app/assets/entry.ts");
// /assets/app/assets/entry.ts
```

With fingerprinting enabled, the result includes the current source fingerprint. Hard-coding `/assets/app/assets/entry.ts` would bypass that deployment detail.

`getPreloads()` returns URLs for an entry and the dependencies the asset server can discover:

```tsx
let preloads = await assetServer.getPreloads("app/assets/entry.ts");

let head = preloads.map((href) => (
  <link key={href} rel="modulepreload" href={href} />
));
```

It returns URL strings, not `<link>` elements. The document decides whether to emit HTML links or HTTP `Link` headers.

Client entries use the same resolver. A component records `import.meta.url`; the shared renderer turns that file URL into the deployment URL:

```tsx filename=app/middleware/render.tsx
import * as path from "node:path";

import { assetServer } from "../assets.ts";

// Inside the existing render middleware:
let stream = renderToStream(node, {
  signal: request.signal,
  async resolveClientEntry(entryId, component) {
    let hashIndex = entryId.lastIndexOf("#");
    let moduleId = hashIndex === -1 ? entryId : entryId.slice(0, hashIndex);
    let explicitExportName =
      hashIndex === -1 ? "" : entryId.slice(hashIndex + 1);

    if (new URL(moduleId).protocol !== "file:") {
      throw new Error(`Expected import.meta.url for client entry: ${entryId}`);
    }

    let exportName =
      explicitExportName || component.name || titleCaseFileName(moduleId);
    if (!exportName)
      throw new Error(`Unable to resolve client entry export for ${entryId}`);

    return {
      href: await assetServer.getHref(moduleId),
      exportName,
    };
  },
});

function titleCaseFileName(fileUrl: string): string {
  let url = new URL(fileUrl);
  let fileName = path.basename(url.pathname, path.extname(url.pathname));
  return fileName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join("");
}
```

Keep the resolver in the renderer so every component, frame, and deployment uses one asset policy. It rejects non-file entry IDs, then `getHref()` applies the asset server's file and package allow rules. The export resolves from an explicit `#ExportName`, the component name, or the generated filename fallback.

## File transforms and transformed-output caches {#asset-file-transforms}

Request transforms let one source file produce a small set of declared variants. Prefer named variants so request input cannot multiply expensive cache entries. This example uses `sharp`; install it with `npm i sharp` before adding the transform:

```ts filename=app/assets.ts
import { createAssetServer, defineFileTransform } from "remix/assets";
import sharp from "sharp";

function resizeTo(width: number) {
  return defineFileTransform({
    extensions: [".png", ".jpg"],
    async transform(bytes) {
      return {
        content: await sharp(bytes)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer(),
        extension: ".webp",
      };
    },
  });
}

export const assetServer = createAssetServer({
  // basePath, fileMap, and allow rules...
  files: {
    extensions: [".png", ".jpg", ".webp"],
    transforms: {
      thumbnail: resizeTo(320),
      card: resizeTo(640),
    },
    maxRequestTransforms: 1,
  },
});

let thumbnailHref = await assetServer.getHref("app/assets/cover.jpg", {
  transform: ["thumbnail"],
});
```

The concrete transform owns decoding and encoding; `defineFileTransform()` owns the typed request pipeline. A transform receives bytes and returns bytes or `{ content, extension }`. If a parameterized transform is necessary, accept a short enum of values rather than an arbitrary dimension. Global transforms run after request-selected transforms.

Repeated transforms may use a `FileStorage` cache. Scope a persistent cache to the transform configuration and build that produced it; otherwise a deployment can reuse bytes created by old code.

## Development watching and production fingerprints {#fingerprinting-source-maps-minification}

Choose one process to notice source changes. The generated app sets `watch: false` because Node's `--watch` restarts the server. If the asset server watches files itself, keep the process alive and call `await assetServer.close()` during shutdown so its watcher is released.

Stable development URLs use ETags and revalidation. Production can instead use long-lived immutable URLs:

```ts filename=app/assets.ts
function requireBuildId(): string {
  let value = process.env.RELEASE_ID;
  if (!value) throw new Error("RELEASE_ID is required in production");
  return value;
}

let buildId = isDevelopment ? undefined : requireBuildId();

// inside createAssetServer({ ... }):
fingerprint: buildId ? { buildId } : undefined,
watch: false,
```

Fingerprinting requires `watch: false`. Every replica in one deployment must use the same fixed build ID, and the value must change for the next deployment. Do not generate a random value independently in each process.

Source maps, browser targets, and minification are deployment choices. Do not enable public production source maps unless source disclosure is acceptable; otherwise omit them and upload maps separately to the error-reporting service. Asset compilation happens on request, so production readiness includes warming or monitoring the asset path rather than assuming a separate bundle already contains every module.

## Parse bounded form uploads {#file-uploads}

The cumulative edit form now lives in `app/assets/album-edit-form.tsx`. Extend that client entry instead of creating a second form in the server page. Add `coverError` to its props and existing destructuring:

```tsx filename=app/assets/album-edit-form.tsx
// Partial update to AlbumEditFormProps:
export interface AlbumEditFormProps {
  // Keep action, conflict, csrfToken, issues, and values.
  coverError?: string;
}

// Replace the existing props destructuring in the render function:
let {
  action,
  conflict,
  coverError,
  csrfToken,
  issues = [],
  values,
} = handle.props;
```

Set `encType="multipart/form-data"` on the existing `<form>` without changing its action, method, or `on("submit", ...)` mixin. Then add this control before the existing `submissionError` and submit button:

```tsx filename=app/assets/album-edit-form.tsx
<>
  {/* Inside the existing form: */}
  <label>
    Cover image
    <input
      accept="image/jpeg,image/png"
      aria-describedby={coverError ? "cover-error" : undefined}
      aria-invalid={coverError ? "true" : undefined}
      name="cover"
      type="file"
    />
  </label>
  {coverError ? (
    <p id="cover-error" role="alert">
      {coverError}
    </p>
  ) : null}
</>
```

The server page only passes props into that form. Carry the upload error through the existing client-entry boundary:

```tsx filename=app/actions/albums/edit/page.tsx
// Add coverError to the existing AlbumEditPageProps interface.
interface AlbumEditPageProps {
  // Keep albumId, conflict, csrfToken, issues, and values.
  coverError?: string;
}

// Read coverError with the existing props, then pass it to the form:
<AlbumEditForm
  action={routes.albums.edit.action.href({ albumId })}
  conflict={conflict}
  coverError={coverError}
  csrfToken={csrfToken}
  issues={issues}
  values={values}
/>;
```

The native form now sends multipart bytes, while the Chapter 8 submit handler still constructs `FormData` from the same form and preserves its pending, redirect, authentication, validation, and cancellation behavior.

For this small cover, retain the uploaded `File` until the authenticated action has validated and authorized the edit. Bound the parser before reading any fields:

```ts
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";

import { uploadErrors } from "./middleware/upload-errors.ts";

// In the existing middleware array, replace formData() with these entries.
// Keep the remaining cumulative entries in their current order.
middleware: [
  // staticFiles(), cop(),
  uploadErrors(),
  formData({
    maxHeaderSize: 16 * 1024,
    maxFiles: 1,
    maxFileSize: 2 * 1024 * 1024,
    maxParts: 8,
    maxTotalSize: 2.5 * 1024 * 1024,
  }),
  methodOverride(),
  // asyncContext(), database, session, CSRF, auth, asset entry, and render...
];
```

Multipart input is read incrementally, but each individual part is accumulated before the upload handler receives it. Limits are therefore part of memory safety, even when an upload handler writes the resulting file to external storage. Set header, file-count, file-size, part-count, and total-size limits appropriate to the route.

Parser errors occur in middleware before the action runs. Put an error-translating middleware before `formData()` if the app should return deliberate upload responses:

```ts filename=app/middleware/upload-errors.ts
import {
  FormDataParseError,
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  MaxHeaderSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
} from "remix/form-data-parser";
import type { Middleware } from "remix/router";

export function uploadErrors(): Middleware {
  return async (_context, next) => {
    try {
      return await next();
    } catch (error) {
      if (
        error instanceof MaxFilesExceededError ||
        error instanceof MaxFileSizeExceededError ||
        error instanceof MaxHeaderSizeExceededError ||
        error instanceof MaxPartsExceededError ||
        error instanceof MaxTotalSizeExceededError
      ) {
        return new Response("Upload exceeds request limits", { status: 413 });
      }
      if (error instanceof FormDataParseError) {
        return new Response("Invalid form data", { status: 400 });
      }
      throw error;
    }
  };
}
```

Register `[uploadErrors(), formData(options)]` in that order. Limit errors are never hidden by `suppressErrors`. Upload-handler errors propagate separately; translate only errors the app recognizes.

## Store files by app-owned keys {#file-storage-memory-filesystem-s3}

The album row needs a storage key, not uploaded bytes or a submitted filename:

```ts filename=app/data/schema.ts
// Update the existing definition in place; do not declare a second albums table.
export const albums = table({
  name: "albums",
  columns: {
    // existing columns...
    cover_key: c.text(),
  },
});
```

Add the matching DDL in a new migration:

```sql filename=db/migrations/20260722140000_add_album_cover/up.sql
alter table albums add column cover_key text;
```

Use one `FileStorage` API in the action and choose a backend for the deployment:

```ts filename=app/files.ts
import { createFsFileStorage } from "remix/file-storage/fs";

export const albumCovers = createFsFileStorage("./var/album-covers");
```

Keep the stored objects out of source control:

```gitignore filename=.gitignore
/var/album-covers/
```

Put the chosen storage behind request context just like the database. That keeps controller imports independent of the production backend:

```ts filename=app/middleware/album-covers.ts
import type { FileStorage } from "remix/file-storage";
import { createContextKey, type Middleware } from "remix/router";

export const AlbumCovers = createContextKey<FileStorage>();

export function loadAlbumCovers(
  storage: FileStorage,
): Middleware<{ key: typeof AlbumCovers; value: FileStorage }> {
  return (context, next) => {
    context.set(AlbumCovers, storage);
    return next();
  };
}
```

Pass the production storage when assembling the router:

```ts filename=app/router.ts
import { albumCovers } from "./files.ts";
import { loadAlbumCovers } from "./middleware/album-covers.ts";

// Add after loadDatabase() in the cumulative middleware array:
loadAlbumCovers(albumCovers),
```

Memory storage fits tests. Filesystem storage fits one host with persistent disk. S3-compatible storage fits multiple stateless app replicas. The app code still uses `get`, `has`, `list`, `put`, `set`, and `remove`. The bundled S3 backend buffers values returned by `get()`; large-object delivery should use a presigned response or a storage adapter with a streaming read path.

The `File` type and `accept` attribute do not prove that the bytes contain an image. Decode into pixels, bound the decoded size, and encode a new app-owned representation. Reuse the `sharp` decoder from the transform example to normalize every accepted cover:

```ts filename=app/data/album-cover.ts
import sharp from "sharp";

export class InvalidAlbumCoverError extends Error {}

export async function normalizeAlbumCover(cover: File): Promise<File> {
  try {
    let image = sharp(new Uint8Array(await cover.arrayBuffer()), {
      failOn: "error",
      limitInputPixels: 24_000_000,
    });
    let metadata = await image.metadata();
    if (metadata.format !== "jpeg" && metadata.format !== "png") {
      throw new InvalidAlbumCoverError();
    }

    let bytes = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    return new File([new Uint8Array(bytes)], "cover.jpg", {
      type: "image/jpeg",
    });
  } catch (error) {
    if (error instanceof InvalidAlbumCoverError) throw error;
    throw new InvalidAlbumCoverError("Cover could not be decoded", {
      cause: error,
    });
  }
}
```

The encoded `File` now has an app-owned name and MIME type. The pixel limit also bounds small compressed inputs that expand dramatically during decoding. Use the corresponding limits and decoder-error type when choosing another image library.

In the complete edit action, keep the submitted `values`, schema parsing, album lookup, ownership check, and `AlbumEditConflictError` from the previous chapters. After those checks, store a new cover under an app-owned key. Then replace the existing transaction block with the artist lookup and guarded album update below:

```tsx filename=app/actions/albums/edit/controller.tsx
import type { FileStorage } from "remix/file-storage";
import { getCsrfToken } from "remix/middleware/csrf";

import {
  InvalidAlbumCoverError,
  normalizeAlbumCover,
} from "../../../data/album-cover.ts";
import { albums, artists } from "../../../data/schema.ts";
import { AlbumCovers } from "../../../middleware/album-covers.ts";
import { AlbumEditPage } from "./page.tsx";

// Inside the authenticated edit action, after validation and authorization.
let cover = context.formData.get("cover");
let normalizedCover: File | null = null;

function renderCoverError(message: string): Response {
  return context.render(
    <AlbumEditPage
      albumId={album.id}
      coverError={message}
      csrfToken={getCsrfToken(context)}
      issues={[]}
      values={values}
    />,
    { status: 400 },
  );
}

if (cover !== null && !(cover instanceof File)) {
  return renderCoverError("Cover must be an uploaded file");
}

if (cover instanceof File && cover.size > 0) {
  if (cover.type !== "image/jpeg" && cover.type !== "image/png") {
    return renderCoverError("Cover must be a JPEG or PNG image");
  }

  try {
    normalizedCover = await normalizeAlbumCover(cover);
  } catch (error) {
    if (error instanceof InvalidAlbumCoverError) {
      return renderCoverError("Cover must contain a valid JPEG or PNG image");
    }
    throw error;
  }
}

let newCoverKey = normalizedCover
  ? `album-covers/${crypto.randomUUID()}`
  : null;
let previousCoverKey = album.cover_key;
let albumCovers = context.get(AlbumCovers);
let { artist: artistName, revision, title, year } = result.value;

try {
  if (newCoverKey && normalizedCover) {
    await albumCovers.set(newCoverKey, normalizedCover);
  }

  await db.transaction(async (transaction) => {
    await transaction
      .query(artists)
      .upsert({ name: artistName }, { conflictTarget: ["name"] });
    let artist = await transaction.findOne(artists, {
      where: { name: artistName },
    });
    if (artist === null) {
      throw new Error("Upserted artist could not be loaded");
    }

    let write = await transaction.updateMany(
      albums,
      {
        artist_id: artist.id,
        title,
        year,
        revision: revision + 1,
        ...(newCoverKey ? { cover_key: newCoverKey } : {}),
      },
      {
        where: {
          id: album.id,
          owner_id: context.auth.identity.id,
          revision,
        },
      },
    );

    if (write.affectedRows === 0) {
      throw new AlbumEditConflictError();
    }
  });
} catch (error) {
  if (newCoverKey) await removeStoredCover(albumCovers, newCoverKey);
  if (error instanceof AlbumEditConflictError) {
    return context.render(
      <AlbumEditPage
        albumId={album.id}
        conflict="This album changed after you opened the form. Reload the latest version before trying again."
        csrfToken={getCsrfToken(context)}
        issues={[]}
        values={values}
      />,
      { status: 409 },
    );
  }
  throw error;
}

if (newCoverKey && previousCoverKey) {
  void removeStoredCover(albumCovers, previousCoverKey);
}

// At module scope:
async function removeStoredCover(
  storage: FileStorage,
  key: string,
): Promise<void> {
  try {
    await storage.remove(key);
  } catch (error) {
    console.error(`Failed to remove stored cover ${key}`, error);
  }
}
```

Keep the action's existing redirect after this excerpt. A rejected cover returns the edit page with status `400`, the submitted text values, and an empty file control. Browsers do not let the server replay the rejected file selection.

The input's filename, extension, MIME type, and `accept` match are still only client claims; the decoded and re-encoded result establishes the bytes and MIME type the app will serve. If an app does not normalize untrusted bytes, serve them as attachments rather than trusted inline media. Never join the submitted filename onto a filesystem path.

External file storage does not participate in the database write. The compensation above attempts to remove a new object when storage or the guarded row update fails, and it schedules cleanup of the replaced object after success. Cleanup failure is reported without hiding the original database error or expected `409`. Production storage should still have an orphan cleanup job for process failures between these steps.

If a larger-file workflow stores data inside an upload handler, use a temporary server-generated key, then promote it only after authorization and validation. Clean up failed and abandoned uploads. Otherwise a rejected request can leave permanent orphan files before the action sees it.

## Use the low-level multipart parser only when needed {#multipart-parsing}

`formData()` and `remix/form-data-parser` are the normal HTML form path. They produce the `FormData` used by schemas, auth providers, CSRF middleware, and actions.

Use `remix/multipart-parser` directly when the body is multipart but not an HTML form, when a runtime needs a different stream adapter, or when the application needs to inspect parts without creating `FormData`. Keep the same limits. Dropping to the parser does not make an unlimited body safe or make partially stored data transactional.

## Stream downloads with correct HTTP semantics {#file-downloads-lazy-files-mime-types-and-range-responses}

Add GET and HEAD routes for the current cover and look up its app-owned key through the album record. Add `head` to the existing `remix/routes` import:

```ts filename=app/routes.ts
// Replace the existing routes.albums branch:
albums: {
  show: get("/albums/:albumId"),
  recommendations: get("/albums/:albumId/recommendations"),
  cover: get("/albums/:albumId/cover"),
  coverHead: head("/albums/:albumId/cover"),
  edit: form("/albums/:albumId/edit"),
  destroy: del("/albums/:albumId"),
},
```

`cover` and `coverHead` are direct leaves of `routes.albums`, so they use the existing `albumsController` mapping. This is the complete controller at this point in the walkthrough. It keeps the previous chapter's authentication middleware, authorizes every album read, implements the earlier destroy route, and sends GET and HEAD through one cover helper:

```tsx filename=app/actions/albums/controller.tsx
import type { FileStorage } from "remix/file-storage";
import { Database } from "remix/data-table";
import { getCsrfToken } from "remix/middleware/csrf";
import { createFileResponse } from "remix/response/file";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

import { albumRelations, albums } from "../../data/schema.ts";
import { AlbumCovers } from "../../middleware/album-covers.ts";
import { requireUser } from "../../middleware/require-user.ts";
import { routes } from "../../routes.ts";
import { AlbumPage } from "./show-page.tsx";

let albumsController = createController(routes.albums, {
  middleware: [requireUser],
  actions: {
    async show(context) {
      let album = await context
        .get(Database)
        .find(albums, context.params.albumId, { with: albumRelations });
      if (
        album === null ||
        album.artist === null ||
        album.owner_id !== context.auth.identity.id
      ) {
        return new Response("Album not found", { status: 404 });
      }

      return context.render(
        <AlbumPage
          album={{ ...album, artist: album.artist }}
          csrfToken={getCsrfToken(context)}
        />,
      );
    },

    async recommendations(context) {
      let album = await context
        .get(Database)
        .find(albums, context.params.albumId);
      if (album === null || album.owner_id !== context.auth.identity.id) {
        return new Response("Album not found", { status: 404 });
      }

      return context.render(
        <aside aria-labelledby="recommendations-heading">
          <h2 id="recommendations-heading">More like {album.title}</h2>
          <p>Recommendations are still being selected.</p>
        </aside>,
      );
    },

    async destroy(context) {
      let db = context.get(Database);
      let album = await db.find(albums, context.params.albumId);
      if (album === null || album.owner_id !== context.auth.identity.id) {
        return new Response("Album not found", { status: 404 });
      }

      let write = await db.deleteMany(albums, {
        where: {
          id: album.id,
          owner_id: context.auth.identity.id,
          revision: album.revision,
        },
      });
      if (write.affectedRows === 0) {
        return new Response("Album changed before it could be deleted", {
          status: 409,
        });
      }

      if (album.cover_key) {
        try {
          await context.get(AlbumCovers).remove(album.cover_key);
        } catch (error) {
          console.error(
            `Failed to remove stored cover ${album.cover_key}`,
            error,
          );
        }
      }

      return redirect(routes.home.href(), 303);
    },

    cover(context) {
      return serveAlbumCover(
        context.request,
        context.params.albumId,
        context.auth.identity.id,
        context.get(Database),
        context.get(AlbumCovers),
      );
    },

    coverHead(context) {
      return serveAlbumCover(
        context.request,
        context.params.albumId,
        context.auth.identity.id,
        context.get(Database),
        context.get(AlbumCovers),
      );
    },
  },
});

export default albumsController;

async function serveAlbumCover(
  request: Request,
  albumId: string,
  ownerId: string,
  db: Database,
  storage: FileStorage,
): Promise<Response> {
  let album = await db.find(albums, albumId);
  if (
    album === null ||
    album.cover_key === null ||
    album.owner_id !== ownerId
  ) {
    return new Response("Cover not found", { status: 404 });
  }

  let file = await storage.get(album.cover_key);
  if (file === null) {
    return new Response("Cover not found", { status: 404 });
  }

  let response = await createFileResponse(file, request, {
    cacheControl: "private, no-cache",
    etag: "strong",
  });
  response.headers.set(
    "Content-Disposition",
    'inline; filename="album-cover.jpg"',
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
```

The show action still passes its request-scoped CSRF token to the delete form. The delete repeats the owner and revision predicates used by the edit action. If an edit commits after the initial read, deletion returns `409` instead of removing the cover key from the stale row. The row is deleted before its external object; a failed object removal is logged for the orphan cleanup job rather than restoring a row whose delete already committed.

For a normal `200` or `206` response, the helper sets the content type and length. It also handles `HEAD`, validators, preconditions, and one satisfiable byte range. Depending on request headers it may return `304`, `206`, `400`, `412`, or `416`. Computing the configured strong ETag reads the complete file before the response body starts; the 2 MiB upload bound makes that cost acceptable and prevents equal-size replacements from sharing a metadata-only validator. For large files, use a stable storage-provided digest rather than buffering solely to hash.

Range support defaults on for non-compressible MIME types and off for compressible ones so compression and byte ranges do not fight each other. Set `acceptRanges` explicitly when the product requires a different policy.

For a download, use a safe app-owned `Content-Disposition` filename. Do not reflect the raw upload name into a response header. Filesystem storage returns a lazy file, so the response body streams from disk. That does not remove the up-front read requested by `etag: "strong"`; use the default weak validator or a precomputed digest when large-file delivery must start without one.

The cover path now has clear boundaries from browser input to stored bytes and HTTP output. [Errors and Cancellation](/errors-and-error-boundaries/) follows each expected failure, unexpected exception, and aborted request through that same path.
