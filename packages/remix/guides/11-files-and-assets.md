---
title: Files and Assets
description: How Remix serves static files and source assets, accepts bounded uploads, stores files, and returns HTTP file responses.
---

A Remix app serves three kinds of files, and each one takes a different path through the app:

- **Files served exactly as they are**, such as a favicon, live in the root `public/` directory and are served by `staticFiles()` from [`remix/middleware/static`](../src/static-middleware/README.md).
- **Browser source that needs compiling**, such as TypeScript, CSS, and images, lives in `public/` directories under `app/` and is served by `createAssetServer()` from [`remix/assets`](../src/assets/README.md).
- **User uploads** are parsed by `formData()` from [`remix/middleware/form-data`](../src/form-data-middleware/README.md), kept in [`remix/file-storage`](../src/file-storage/README.md), and sent back with `createFileResponse()` from [`remix/response/file`](../src/response/README.md).

## Serve files as-is with staticFiles()

Files that never change between your source and the browser, such as `favicon.svg` or `robots.txt`, belong in the root `public/` directory. Serve them with `staticFiles()` from [`remix/middleware/static`](../src/static-middleware/README.md) near the front of the router middleware:

```ts filename=app/router.ts
import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
import { createRouter } from "remix/router";

import { assets } from "./assets.ts";

export const router = createRouter({
  middleware: [staticFiles("./public", { index: false }), render({ assets })],
});
```

A request for `/favicon.svg` returns `public/favicon.svg` with a `Content-Type`, an ETag, and support for conditional and range requests. `staticFiles()` only answers `GET` and `HEAD` requests, and when no file matches, the request falls through to the rest of the router. Set `index: false` when `/` should reach your home route instead of looking for `public/index.html`.

The other options control which files are visible and how they're cached:

```ts
staticFiles("./public", {
  index: false,
  cacheControl: "public, max-age=3600",
  filter: (path) => !path.split("/").some((segment) => segment.startsWith(".")),
});
```

`filter` receives the requested path relative to the directory, so this one hides dotfiles. `cacheControl`, `etag`, and `lastModified` are the same options [`createFileResponse()` accepts](#send-stored-and-on-disk-files). To serve more than one directory, add another `staticFiles()` call with its own options.

## How the asset server works

Browser code needs more than a static directory. It's written in TypeScript and JSX, imports npm packages, references stylesheets and images, and should reload while you work and be minified and cached aggressively in production. Those are the jobs you'd normally hand to a bundler. The asset server in [`remix/assets`](../src/assets/README.md) handles them without a build step:

- **There are no entry points.** You don't give the asset server a module graph up front. You tell it which files the browser may request, and it compiles each one when it's requested.
- **Compilation is one file at a time.** TypeScript and JSX become JavaScript, but imports stay as you wrote them. Bare specifiers like [`remix/component`](../src/component/README.md) resolve through an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap), so the code running in the browser looks like your source.
- **Questions a build manifest would answer are answered at request time.** `getScriptEntry()`, `getHref()`, and `getPreloads()` tell you an asset's public URL and what it depends on while you render a page.
- **Development and production work the same way.** Watching, minification, and fingerprinting are settings. The architecture doesn't change when you deploy.
- **It's a fetch handler.** `assets.fetch(request)` returns a `Response`, or `null` when the request isn't for a servable asset. Nothing ties it to Remix internals, so it can serve browser code for any frontend.

Serving modules unbundled is a deliberate choice, and it pays off in two ways.

**Nothing runs between your code and the runtime.** There's no build to wait for, no bundler configuration to maintain, and no framework plugin rewriting your modules behind the scenes. Starting the server doesn't compile the whole app, because each module is compiled the first time it's requested. The browser runs one module per source file with your imports intact, so the network panel, stack traces, and source maps point at code you recognize. This follows Remix's [religiously runtime](/start-here/#what-is-remix) principle: the code you write runs in development and production without a bundling step in between.

**Caching is per module.** With a bundler, each output file's hash is written into every file that imports it. Change one shared module and the hashes cascade up the tree, so returning visitors re-download most of the app. With fingerprinting enabled, the asset server keeps imports pointing at stable URLs and lets the import map supply each module's current fingerprint. Upgrading a dependency used everywhere, such as [`remix/component`](../src/component/README.md), means returning visitors download only the files that changed inside it. Everything else, including your app code that imports it, stays cached. Fingerprinting is one of the [production settings](#production-asset-settings), where the import map behind it is shown in full.

The cost is more requests: the browser downloads many small modules instead of a few large bundles. Preloads let it request the whole module graph at once, and HTTP/2 downloads those modules in parallel, so for most apps, especially new ones, this is fast enough. A very large app may eventually benefit from a bundler. Treat it as an optimization you add when you measure a need for it, not as a prerequisite for starting.

## Serve browser source with the asset server

Create the asset server in its own module, such as `app/assets.ts`, so the router, controllers, and document can share one instance:

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

`basePath` is the URL namespace for assets. Compiled modules and stylesheets reference each other by URL, so the asset server also uses it to write links back to itself. Files are served beneath that path through two default mounts that preserve the path below each directory:

- `app/actions/public/entry.ts` is served at `/assets/app/actions/public/entry.ts`.
- `node_modules/remix/...` is served beneath `/assets/npm/remix/...`.

The asset server only answers requests that reach it, so give it a route and an action:

```ts filename=app/routes.ts
import { get, route } from "remix/routes";

export const routes = route({
  assets: get("/assets/*path"),
  home: "/",
});
```

```tsx filename=app/actions/controller.tsx
import { createController } from "remix/router";

import { assets } from "../assets.ts";
import { routes } from "../routes.ts";

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response("Not Found", { status: 404 });
    },
    // ...
  },
});
```

`assets.fetch()` resolves to `null` for anything it can't serve, including denied files and stale fingerprints, so the action supplies the `404`.

The same server is passed to `render({ assets })` from [`remix/middleware/render`](../src/render-middleware/README.md) in `app/router.ts`. That's how the renderer [turns hydrated components into script URLs](#how-client-entries-find-their-scripts).

## Control what the browser can reach

`allowFiles`, `allowPackages`, and `denyFiles` decide which files on your server the browser can download. Treat them as a security boundary, not as build configuration. Anything they allow can be requested by anyone who knows the URL.

The configuration above allows two things from your app:

- `app/**/public/**` allows any file inside a `public/` directory under `app/`. Put browser code beside its narrowest owner, such as `app/actions/albums/edit/public/` or `app/ui/public/`, so you, a reviewer, or an agent can tell from a file's path whether the browser can reach it.
- `app/routes.ts` is allowed on its own so browser code can import `routes` and build links with `routes.albums.show.href(...)`.

Every local import in a browser module must also be allowed. Keep a browser module's local dependencies inside the same `public/` directory, or in another `public/` directory. If a browser module imports a server-only file, the asset server refuses to compile it rather than exposing that file.

`denyFiles` takes precedence over both allow lists. Denying `app/**/*.test.*` lets tests sit beside the browser modules they exercise without becoming downloadable.

### Use npm packages in browser code

Browser code imports npm packages by name, and the import map points each name at the `/assets/npm` mount:

```ts filename=app/ui/public/release-date.ts
import { format } from "date-fns";

export function formatReleaseDate(date: Date) {
  return format(date, "MMMM d, yyyy");
}
```

A few rules apply to packages:

- Add each package that browser code imports to `allowPackages`, such as `["remix", "date-fns"]`. Its dependencies and installed optional dependencies are allowed automatically. Peer dependencies are not, so list them explicitly.
- The asset server serves ES modules. A package that only ships CommonJS fails to compile.
- To leave an import untouched, for example one your page provides through its own import map entry, list the specifier in `scripts.external`.

### Debug asset URLs with remix assets

When a browser module fails to load, the asset server reports a compilation error through its `onError` hook, which logs the error and responds with `500` by default. The error code tells you which rule stopped it:

- `IMPORT_NOT_ALLOWED`: the import resolved to a file that no allow rule matches, or that a deny rule matches.
- `IMPORT_OUTSIDE_MOUNTS`: the file exists but has no public URL because no mount covers it.
- `IMPORT_NOT_SUPPORTED`: the import isn't a script, such as `import "./styles.css"`. Stylesheets and images are [referenced by URL](#reference-styles-images-and-fonts) instead.

To see what the browser can reach, ask the asset server directly:

```ts
import { assets } from "./app/assets.ts";

let details = await assets.getAssetDetails("/assets/app/ui/public/release-date.ts");
console.log(details.status, details.access?.deniedBy);
```

`getAssetDetails()` accepts a URL or a file path and reports whether it's `reachable`, `denied`, `not-allowed`, `missing`, `unmapped`, or `unsupported`, along with the rule responsible. `getAssets()` lists every reachable file and its URL.

The `remix assets` command prints the same information from the terminal. `remix assets` lists every reachable file as `URL -> file`, and `remix assets inspect <url-or-file>` explains one mapping. The CLI reads its configuration from the `assets` section of `remix.json` rather than from `app/assets.ts`. You can [move the configuration into `remix.json`](/cli-and-tooling/) so the server and CLI share it.

## Load browser scripts

A page that runs browser code needs three things from the asset server: the entry module's URL, the URLs of every module it depends on, and an import map for bare specifiers. `getScriptEntry()` returns all three. For an entry every page loads, resolve it once in `app/assets.ts`:

```ts filename=app/assets.ts
const entry = "app/actions/public/entry.ts";

export const scriptEntry = await assets.getScriptEntry(entry);
```

The document renders them in `<head>`:

```tsx filename=app/actions/document.tsx
import type { Handle, RemixNode } from "remix/component";
import { ImportMap } from "remix/component/server";

import { scriptEntry } from "../assets.ts";

export function Document(handle: Handle<{ children?: RemixNode; title?: string }>) {
  return () => {
    let { href, importMap, preloads } = scriptEntry;

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>{handle.props.title ?? "Albums"}</title>
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body>{handle.props.children}</body>
      </html>
    );
  };
}
```

`preloads` lists every module the entry depends on. Without those `<link rel="modulepreload">` tags, the browser would download the entry, discover its imports, download those, and repeat one level at a time. With them, it requests the whole graph at once.

That's also the answer to "isn't that a lot of files?" Many small modules download in parallel over HTTP/2. A plain `node:http` server speaks HTTP/1.1, so production deployments usually get HTTP/2 from the proxy or CDN in front of the app.

`<ImportMap>` from [`remix/component/server`](../src/component/server/README.md) renders the entry's import map merged with the import maps of hydrated components on the page, so the document contains one complete map. Frame responses can add mappings later. Browsers without native support for multiple import maps need [`remix/multiple-import-maps-polyfill`](../src/multiple-import-maps-polyfill/README.md), which a [browser entry can load](/interactivity/#browser-entry-with-run).

### How client entries find their scripts

A hydrated component declares where its code lives with `clientEntry(import.meta.url, ...)`. On the server, `import.meta.url` is a `file://` URL for the component's module, which is meaningless to a browser. When the page renders, `render({ assets })` passes that ID to `assets.getScriptEntry()` and gets back the public `href`, `preloads`, and import map for the component's module. This lookup is the part a bundler's build manifest would normally provide. Remix components don't depend on the asset server. They only need something that can resolve an entry ID to a URL.

### Barrel files

Packages often re-export everything through an `index.js` barrel. When you import a named binding through one, such as `import { css } from "remix/component"`, the asset server rewrites the import to the module that defines `css`, so the browser skips the barrel and every unrelated module it re-exports. This is an optimization that doesn't change behavior: it only applies when every skipped module is declared side-effect free by its package's `sideEffects` field in `package.json`. Without that metadata, the import is served as written.

## Reference styles, images, and fonts

Browser modules can only import other scripts, so stylesheets, images, and fonts are referenced by URL. `getHref()` returns the public URL for any allowed asset:

```ts filename=app/assets.ts
export const assets = createAssetServer({
  basePath: "/assets",
  rootDir: process.cwd(),
  allowFiles: ["app/routes.ts", "app/**/public/**"],
  allowPackages: ["remix"],
  denyFiles: ["app/**/*.test.*"],
  files: {
    extensions: [".svg", ".png", ".jpg", ".woff2"],
  },
});

export const stylesheetHref = await assets.getHref("app/actions/public/app.css");
```

Stylesheets are served by default. Images, fonts, and other leaf files are only served when their extension is listed in `files.extensions`.

Render the stylesheet in the document's `<head>` next to the script entry:

```tsx filename=app/actions/document.tsx
<link rel="stylesheet" href={stylesheetHref} />
```

Relative `@import` and `url()` references inside CSS are rewritten to asset URLs, so a stylesheet can reference fonts and images beside it:

```css filename=app/actions/public/app.css
@import "./reset.css";

@font-face {
  font-family: "Inter";
  src: url("./fonts/inter.woff2") format("woff2");
}
```

To start downloading that font before the stylesheet is parsed, preload the same URL with `<link rel="preload" href={fontHref} as="font" type="font/woff2" crossOrigin="anonymous" />`, where `fontHref` comes from `getHref()`. Stylesheets can have preloads too, through `getPreloads()`, but a single `<link rel="stylesheet">` is rarely worth more than that.

### Pass asset URLs to components

`getHref()` is async and runs on the server, and components render synchronously. Resolve URLs before rendering, then pass them in as props. A helper beside the asset can use `import.meta.url` to locate it:

```ts filename=app/ui/cover-placeholder.ts
import { assets } from "../assets.ts";

export function getCoverPlaceholderHref() {
  return assets.getHref(new URL("./public/cover-placeholder.svg", import.meta.url).href);
}
```

```tsx filename=app/actions/albums/controller.tsx
// inside the show action:
let placeholderHref = await getCoverPlaceholderHref();

return context.render(<AlbumPage album={album} placeholderHref={placeholderHref} />);
```

Values every page needs, like the stylesheet, belong in `app/assets.ts`. Values one route needs belong in its action. Some apps instead use an async function that resolves the document's assets and returns the `Document` component, which keeps that lookup next to the markup that uses it.

### Transform images and other files

File transforms change a file on its way to the browser, such as resizing an image or converting it to WebP. Request transforms are named in the asset server and chosen per URL:

```ts filename=app/assets.ts
import { createAssetServer, createFsFileCache, defineFileTransform } from "remix/assets";
import sharp from "sharp";

export const assets = createAssetServer({
  // ...
  files: {
    extensions: [".svg", ".png", ".jpg", ".woff2"],
    transforms: {
      resize: defineFileTransform({
        extensions: [".png", ".jpg"],
        param: true,
        async transform(bytes, { param }) {
          let width = Number(param);

          if (!Number.isInteger(width) || width < 16 || width > 2000) {
            throw new TypeError("Expected a width between 16 and 2000");
          }

          return sharp(bytes).resize({ width }).toBuffer();
        },
      }),
      webp: defineFileTransform({
        extensions: [".png", ".jpg"],
        async transform(bytes) {
          let content = await sharp(bytes).webp({ quality: 80 }).toBuffer();
          return { content, extension: ".webp" };
        },
      }),
    },
    cache: createFsFileCache(),
    cacheKey: process.env.GIT_COMMIT_SHA,
  },
});
```

Chain transforms with `getHref()`. Plain names run a transform, and `[name, param]` tuples pass it a parameter:

```ts
let coverHref = await assets.getHref("app/ui/public/thriller.jpg", {
  transform: [["resize", "400"], "webp"],
});
// "/assets/app/ui/public/thriller.jpg?transform=resize%3A400&transform=webp"
```

Hand-written URLs in CSS use the same query syntax, such as `url("./thriller.jpg?transform=resize:400&transform=webp")`.

Anyone can request any transform chain by editing the URL, so validate parameters and keep them within bounds like the `resize` transform does. `files.maxRequestTransforms` caps the length of a chain and defaults to `5`. For processing every file of a type, such as optimizing all SVGs, use `files.globalTransforms`. Global transforms run after request transforms and can return `null` to skip a file.

Transformed files are recomputed on every request unless you configure `files.cache`. `createFsFileCache()` stores them on disk in `node_modules/.cache/remix/assets` with size and entry limits. Set `files.cacheKey` to a value that changes with each deploy, such as a commit SHA, so cached files are reused across restarts but not across code changes. The [`remix/assets` overview](../src/assets/README.md) covers the cache limits and custom caches.

Image transforms usually depend on a third-party library such as Sharp, which you install separately with `npm i sharp`.

## Hot reloading in development

There are two ways to pick up changes while you work, and they trade simplicity for speed:

- **Restart on change.** Run the server with Node's `--watch` so it restarts when server code changes, and set the asset server's `watch` option so browser source is recompiled when it changes. You refresh the page to see updates. There are no extra moving parts, but every change loses client state.
- **Hot module replacement.** Run the server through [`remix/node-hmr`](../src/node-hmr/README.md), which reloads changed server modules without restarting the process, and enable the asset server's `hmr` option so the page updates in place. Updates are faster and keep client state, at the cost of a separate runner process and a few more options.

For HMR, the asset server opts in when the runner is active:

```ts filename=app/assets.ts
import { createAssetServer } from "remix/assets";
import { componentHmr } from "remix/component-hmr/assets";

const isDevelopment = process.env.NODE_ENV === "development";
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR);

export const assets = createAssetServer({
  // ...
  watch: isDevelopment,
  hmr: isHmr
    ? {
        channel: async () => (await import("remix/node-hmr/runtime")).createBrowserHmrChannel(),
        moduleImporter: "remix/multiple-import-maps-polyfill",
      }
    : undefined,
  scripts: { loaders: isHmr ? [componentHmr()] : undefined },
});
```

`createBrowserHmrChannel()` from [`remix/node-hmr/runtime`](../src/node-hmr/README.md) connects the asset server to the browser. `componentHmr()` from [`remix/component-hmr/assets`](../src/component-hmr/README.md) is a script loader that lets hydrated Remix components swap in new code in place, remounting only when a component's setup code changes.

Server-rendered components update too. When server code changes, a browser entry can listen for the `server:update` event and reload the top frame, which fetches fresh HTML from the server and reconciles it into the page:

```ts filename=app/actions/public/entry.ts
if (import.meta.hot) {
  import.meta.hot.on("server:update", async () => {
    await app.ready();
    await app.frames.top.reload();
  });
}
```

Your own browser modules can use the same `import.meta.hot` API. `accept()` marks a module as able to replace itself, `dispose()` cleans up before the old version is discarded, and `invalidate()` gives up and reloads when an update can't be applied:

```ts filename=app/ui/public/now-playing.ts
let timer = setInterval(updateProgress, 1000);

if (import.meta.hot) {
  import.meta.hot.dispose(() => clearInterval(timer));
  import.meta.hot.accept();
}
```

Add [`remix/assets/types/hmr`](../src/assets/README.md) to `types` in `tsconfig.json` to type `import.meta.hot`. Write `import.meta.hot.accept(...)` calls directly rather than through an alias, because the asset server finds them by reading the source.

## Production asset settings

Development and production want different asset server settings:

```ts filename=app/assets.ts
const nodeEnv = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnv === "development";
const isProduction = nodeEnv === "production";

export const assets = createAssetServer({
  // ...
  sourceMaps: isDevelopment ? "external" : undefined,
  minify: !isDevelopment,
  fingerprint: isProduction,
  watch: isDevelopment,
});
```

Production turns off watching, minifies scripts, and enables fingerprinting.

Without fingerprints, assets are served at stable URLs with ETags and `Cache-Control: no-cache`. That's correct, but a repeat visit still sends one revalidation request per module and receives a `304` for each. With `fingerprint: true`, every asset URL includes a hash of its contents, such as `/assets/app/ui/public/cart.@k3x9f2.ts`, and is served with `Cache-Control: public, max-age=31536000, immutable`. Repeat visits load unchanged modules from the browser cache without touching the network. Fingerprints are computed from files on disk, so they require `watch: false`.

Fingerprints stay fine-grained because of the import map. With a bundler, a file's hash is written into every file that imports it, so changing one shared module changes the hash of everything above it and invalidates most of the app's cache. Here, scripts keep importing stable URLs, and the import map points each stable URL at its current fingerprint:

```json
{
  "imports": {
    "/assets/app/ui/public/cart.ts": "/assets/app/ui/public/cart.@k3x9f2.ts"
  }
}
```

Changing `cart.ts` changes one import map entry and one download. The modules that import it keep their URLs and stay cached. Stylesheets have no import maps, so a changed stylesheet does change the fingerprint of stylesheets that `@import` it.

The asset server only serves current fingerprints. A page rendered before a deploy may request a fingerprint that no longer exists, so put a CDN in front of the asset routes that keeps immutable responses after a deploy.

A few more options are worth setting for production:

```ts filename=app/assets.ts
export const assets = createAssetServer({
  // ...
  target: { chrome: "109", firefox: "115", safari: "16" },
  scripts: {
    define: { "process.env.NODE_ENV": JSON.stringify(nodeEnv) },
  },
  onError(error) {
    console.error("Asset compilation failed", error);
    return new Response("Internal Server Error", { status: 500 });
  },
});
```

- `target` lowers modern syntax for the browsers you support. It accepts `chrome`, `firefox`, `safari`, `edge`, `opera`, `ios`, `samsung`, and `es`.
- `sourceMaps` can be `"external"` or `"inline"`. Enabling them in production makes debugging easier but lets anyone download your original source, so decide which matters more for your app.
- `scripts.define` replaces global identifiers with constant expressions. Values are inserted as code, so strings need their own quotes.
- `onError` receives unexpected compilation failures. Report them to your error tracker and return a response, or return nothing for the default `500`.

Call `assets.close()` during shutdown, after the HTTP server closes, so a watching asset server doesn't keep the process alive:

```ts filename=server.ts
server.close(() => assets.close().finally(() => process.exit(0)));
```

There is no build step to run before starting the server. Each asset is compiled the first time it's requested and kept in memory. The rest of your responses need their own [cache policy](/production/#caching) and [compression](/production/#compression-and-streams) settings.

## Accept file uploads

An HTML form uploads files when it uses `encType="multipart/form-data"` and contains a file input:

```tsx filename=app/actions/albums/edit-cover/page.tsx
<form
  action={routes.albums.editCover.action.href({ albumId: album.id })}
  method="post"
  encType="multipart/form-data"
>
  <label>
    Cover image
    <input type="file" name="cover" accept="image/png, image/jpeg" required />
  </label>
  <button type="submit">Upload cover</button>
</form>
```

`accept` filters the browser's file picker. It's a convenience for the user, not validation, since any client can send any file.

On the server, `formData()` from [`remix/middleware/form-data`](../src/form-data-middleware/README.md) parses the multipart body. Without options, it keeps each uploaded file in memory as a `File` in `context.formData`. For uploads you intend to keep, pass an `uploadHandler` that stores each file and returns a value to put in the form instead, usually a storage key:

```ts filename=app/actions/albums/edit-cover/upload.ts
import type { FileUpload } from "remix/form-data-parser";

import { coverStorage } from "../../../storage.ts";

export class InvalidCoverError extends Error {}

const signatures = [
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
];

export async function uploadCover(upload: FileUpload) {
  if (upload.fieldName !== "cover" || upload.name === "") return;

  let head = new Uint8Array(await upload.slice(0, 4).arrayBuffer());
  let match = signatures.find((signature) =>
    signature.bytes.every((byte, index) => head[index] === byte),
  );

  if (match === undefined) {
    throw new InvalidCoverError("Cover images must be PNG or JPEG files");
  }

  let key = crypto.randomUUID();
  await coverStorage.set(key, new File([upload], upload.name, { type: match.type }));

  return key;
}
```

This handler:

- Ignores fields it doesn't expect and empty file inputs. Returning nothing leaves the field out of the form.
- Checks the file's first bytes instead of trusting the submitted `type` or file name extension, then stores the file with the media type it detected.
- Stores the file under a key the server generates. The submitted name is kept only as metadata on the stored `File`.

Put `formData()` on the action that accepts the upload rather than on the whole router, using [action middleware](/routing-and-controllers/#controllers-and-actions), so other requests skip multipart parsing:

```tsx filename=app/actions/albums/edit-cover/controller.tsx
import { formData } from "remix/middleware/form-data";
import { createController } from "remix/router";

import { routes } from "../../../routes.ts";
import { uploadCover } from "./upload.ts";
import { uploadErrors } from "./upload-errors.ts";

export default createController(routes.albums.editCover, {
  actions: {
    index(context) {
      // render the upload form
    },
    action: {
      middleware: [
        uploadErrors,
        formData({
          uploadHandler: uploadCover,
          maxFiles: 1,
          maxFileSize: 5 * 1024 * 1024,
        }),
      ],
      async handler(context) {
        // validate context.formData and save the cover
      },
    },
  },
});
```

### Limit upload size

The parser enforces limits while it reads the body, so an oversized request fails before it's fully read:

| Option          | Default                             | Limits                                         |
| --------------- | ----------------------------------- | ---------------------------------------------- |
| `maxFileSize`   | 2 MiB                               | The size of each file                          |
| `maxFiles`      | 20                                  | The number of files                            |
| `maxParts`      | 1000                                | The number of fields and files combined        |
| `maxTotalSize`  | `maxFiles * maxFileSize` plus 1 MiB | The size of the whole body                     |
| `maxHeaderSize` | 8 KiB                               | The headers of each part in the multipart body |

The 2 MiB default for `maxFileSize` is lower than most photos, so set it for each upload action.

The stable parser reads each file into memory before calling `uploadHandler`, so `maxFileSize` also bounds how much memory one file can use.

When a limit is exceeded, `formData()` throws one of the error classes from [`remix/form-data-parser`](../src/form-data-parser/README.md). Middleware placed before it can turn those errors into responses:

```ts filename=app/actions/albums/edit-cover/upload-errors.ts
import {
  MaxFileSizeExceededError,
  MaxFilesExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
} from "remix/form-data-parser";
import type { Middleware } from "remix/router";

import { InvalidCoverError } from "./upload.ts";

export const uploadErrors: Middleware = async (context, next) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof MaxFileSizeExceededError || error instanceof MaxTotalSizeExceededError) {
      return new Response("Cover images must be 5 MB or smaller", { status: 413 });
    }

    if (error instanceof MaxFilesExceededError || error instanceof MaxPartsExceededError) {
      return new Response("Upload one cover image", { status: 400 });
    }

    if (error instanceof InvalidCoverError) {
      return new Response(error.message, { status: 415 });
    }

    throw error;
  }
};
```

Errors thrown by your `uploadHandler`, like `InvalidCoverError`, reach this middleware unchanged. Anything else is rethrown so the router's normal error handling applies. In a real form, you'll usually [re-render the form with the error](/forms-and-mutations/#return-validation-failures-with-the-form) instead of returning plain text.

### Stream large uploads

To accept files larger than you want to hold in memory, try `formData()` from [`remix/middleware/form-data/future`](../src/form-data-middleware/README.md). It takes the same options, but each upload streams from the request body into your `uploadHandler`:

```ts
import type { FileUpload } from "remix/form-data-parser/future";
import { formData } from "remix/middleware/form-data/future";

import { trackStorage } from "../../../storage.ts";

async function uploadTrack(upload: FileUpload) {
  let key = crypto.randomUUID();
  await trackStorage.set(key, upload);
  return key;
}

let parseTracks = formData({ uploadHandler: uploadTrack, maxFileSize: 500 * 1024 * 1024 });
```

Paired with a storage backend that streams, such as the filesystem or S3 backends, a large upload goes from the request to storage without being buffered. The future `FileUpload` can only be read once, inside the handler, and doesn't support `slice()`, so check file contents after storing them and remove files that fail. Future entrypoints aren't stable and may change in any release.

### Parse multipart and tar streams directly

`formData()` covers HTML form uploads. For other multipart formats, or when you need to process each part yourself, use [`remix/multipart-parser`](../src/multipart-parser/README.md) directly, keeping its header, part, and size limits in place. To read uploaded tar archives as streams, use [`remix/tar-parser`](../src/tar-parser/README.md).

## Validate uploads

The upload handler runs while the body is being parsed, which means each file is stored before your action runs and before later fields in the form have been read. Plan validation around that order:

- **Reject unauthorized requests before parsing.** Put authentication, such as `requireAuth()` from [`remix/middleware/auth`](../src/auth-middleware/README.md), and any check that the user may edit this album in middleware before `formData()`. [`remix/middleware/cop`](../src/cop-middleware/README.md) rejects cross-origin form posts before they reach the parser. Otherwise, anyone can fill your storage.
- **Validate the key, not a file.** When the handler returns a storage key, the parsed form contains a string. Validate it with `f.field()` from [`remix/data-schema/form-data`](../src/data-schema/README.md). `f.file()` is for forms parsed without an upload handler, where the value is a `File`.
- **Treat the submitted name and type as untrusted.** Never use a file name as a path or join it to a directory, and don't derive the stored extension or media type from it.
- **Clean up after later failures.** If validation fails after a file is stored, remove it.

The handler for the cover upload puts those rules together:

```tsx filename=app/actions/albums/edit-cover/controller.tsx
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { requireAuth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

import { routes } from "../../../routes.ts";
import { coverStorage } from "../../../storage.ts";
import { updateAlbum } from "../data.ts";
import { uploadCover } from "./upload.ts";
import { uploadErrors } from "./upload-errors.ts";

const coverForm = f.object({
  cover: f.field(s.string()),
});

export default createController(routes.albums.editCover, {
  middleware: [requireAuth()],
  actions: {
    index(context) {
      // render the upload form
    },
    action: {
      middleware: [
        uploadErrors,
        formData({ uploadHandler: uploadCover, maxFiles: 1, maxFileSize: 5 * 1024 * 1024 }),
      ],
      async handler({ formData, params }) {
        let result = s.parseSafe(coverForm, formData);

        if (!result.success) {
          return new Response("Choose a cover image", { status: 400 });
        }

        let coverKey = result.value.cover;
        let album = await updateAlbum(params.albumId, { coverKey });

        if (album === undefined) {
          await coverStorage.remove(coverKey);
          return new Response("Album not found", { status: 404 });
        }

        return redirect(routes.albums.show.href({ albumId: album.id }), 303);
      },
    },
  },
});
```

`requireAuth()` needs [`auth()` earlier in the router middleware](/auth-sessions-security/#request-auth-schemes). When an album already has a cover, remove the previous key after saving the new one so replaced files don't accumulate.

## Store files

[`remix/file-storage`](../src/file-storage/README.md) defines one `FileStorage` interface for keeping `File` objects under string keys, with interchangeable backends:

```ts filename=app/storage.ts
import { createFsFileStorage } from "remix/file-storage/fs";

export const coverStorage = createFsFileStorage("./storage/covers");
```

The interface works like a `Map` of files:

- `set(key, file)` stores a file, and `get(key)` returns it or `null`. Stored files keep their `name`, `type`, `size`, and `lastModified`.
- `has(key)` checks for a key, and `remove(key)` deletes it.
- `list({ prefix, limit, cursor, includeMetadata })` pages through keys, optionally with each file's metadata.
- `put(key, file)` stores a file and returns a new one backed by storage.

Choose a backend by where the app runs:

- [`remix/file-storage/memory`](../src/file-storage/README.md) keeps files in the process. Use it to [isolate upload tests](/testing/#isolate-stateful-app-tests).
- [`remix/file-storage/fs`](../src/file-storage/README.md) writes to a directory on one server. Give it a directory dedicated to that storage. Files from `get()` are lazy, so they stream from disk instead of loading into memory.
- [`remix/file-storage/s3`](../src/file-storage-s3/README.md) stores files in AWS S3 or an S3-compatible service. Use it when the app runs on more than one server, since [every replica needs the same storage](/production/#process-safe-storage).

Because every backend implements the same interface, upload handlers and file routes don't change when the backend does.

### Store files in S3

```ts filename=app/storage.ts
import { createS3FileStorage } from "remix/file-storage/s3";

export const coverStorage = createS3FileStorage({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  bucket: "album-covers",
  region: "us-east-1",
});
```

`set()` streams files to S3, using multipart uploads for files larger than one part, so a large file never has to fit in memory. `put()` uses the same upload but holds the whole file in memory to return it, so prefer `set()` for large files. For S3-compatible services such as MinIO or LocalStack, set `endpoint` and `forcePathStyle: true`.

Failed uploads are aborted so S3 doesn't keep their parts, but a process that exits mid-upload can't abort. Add a bucket lifecycle rule that removes incomplete multipart uploads.

## Send stored and on-disk files

`createFileResponse()` from [`remix/response/file`](../src/response/README.md) turns any `File` into a response with HTTP file semantics: `Content-Type` from the file's `type`, `Content-Length`, ETags, `Last-Modified`, conditional requests, `HEAD`, and byte ranges. It works the same whether the file came from storage or from disk. Ranges are only enabled for media types that aren't compressible by default, so [`remix/middleware/compression`](../src/compression-middleware/README.md) can still compress text while video and audio support seeking.

### Serve uploaded files

Stored files are served through a route of your own. `staticFiles()` can't serve a storage directory, because the filesystem backend stores files under hashed names rather than their keys. The route is also where you check who may see a file:

```tsx filename=app/actions/albums/controller.tsx
import { createFileResponse } from "remix/response/file";
import { createController } from "remix/router";

import { routes } from "../../routes.ts";
import { coverStorage } from "../../storage.ts";
import { getAlbum } from "./data.ts";

export default createController(routes.albums, {
  actions: {
    async cover({ params, request }) {
      let album = await getAlbum(params.albumId);
      let file = album?.coverKey ? await coverStorage.get(album.coverKey) : null;

      if (file == null) {
        return new Response("Cover not found", { status: 404 });
      }

      return createFileResponse(file, request, { cacheControl: "no-cache" });
    },
    // ...
  },
});
```

The cover URL, `/albums/thriller/cover`, stays the same when a new cover is uploaded, so `no-cache` makes browsers revalidate with the ETag. If the URL included the storage key instead, the response could be cached as immutable. Use `private` for files only the signed-in user should see, so shared caches don't store them.

Uploaded files are served with the type you stored them with, plus `X-Content-Type-Options: nosniff`. That doesn't stop a browser from rendering a file declared as HTML or SVG, and both can run scripts on your origin. Either validate contents and allow only safe types, as the cover handler does, or send uploads as downloads with `Content-Disposition: attachment`.

### Send files from disk

For files on the server's filesystem, open them with `openLazyFile()` from [`remix/fs`](../src/fs/README.md). The file is read lazily and streamed into the response:

```ts filename=app/actions/albums/controller.tsx
import { openLazyFile } from "remix/fs";
import { ContentDisposition } from "remix/headers";
import { createFileResponse } from "remix/response/file";

// inside an action:
let file = openLazyFile("./downloads/thriller-liner-notes.pdf");
let response = await createFileResponse(file, request);

response.headers.set(
  "Content-Disposition",
  new ContentDisposition({ type: "attachment", filename: "Thriller liner notes.pdf" }).toString(),
);

return response;
```

`openLazyFile()` detects the media type from the file extension. For extensions it doesn't know, register them with `defineMimeType()` from [`remix/mime`](../src/mime/README.md). `ContentDisposition` from [`remix/headers`](../src/headers/README.md) builds the header value, including an RFC 8187 `filenameSplat` for file names that aren't plain ASCII.

Avoid reading large files into a native `File` or `ArrayBuffer` first. Lazy files and storage backends stream, so memory use stays flat no matter how large the file is.
