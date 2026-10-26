---
title: Production
description: How a Remix app runs in production, from the server process to request URLs, state, caching, compression, and what Remix needs from a runtime.
---

Remix is runtime-agnostic. A production Remix app is a Fetch handler: `router.fetch(...)` takes a `Request` and returns a `Response`, and a small entry file connects it to whatever runtime serves it, as [Request Handling](/guides/request-handling/) describes. There's no build step by default. The runtime loads the TypeScript source, and the asset server compiles browser modules when the browser asks for them.

This chapter uses Node for its examples and covers what that setup means in production: starting and stopping the server, the public URL behind a proxy, state, caching, compression, and what Remix needs from a runtime.

## How a Remix app runs in production

As a reminder, a full stack Remix app has a few main pieces:

```txt
app/
├── actions/     # controllers, pages, and browser code in public/ directories
├── assets.ts    # the asset server, which compiles browser modules and styles
├── router.ts    # middleware and controller mappings
└── routes.ts    # the route map
public/          # files served as-is by staticFiles()
server.ts        # connects the router to the runtime
package.json
```

<!-- VERIFY: whether remix/assets (native oxc/lightningcss bindings, node: APIs) runs under Bun or Deno is unconfirmed; these entries match ch03. -->

`server.ts` is the only part that knows which runtime is serving the app. Node needs an adapter for its HTTP server, while Bun and Deno accept Fetch handlers directly:

```ts filename=server.ts
import { router } from "./app/router.ts";

// Node
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

http.createServer(createRequestListener(router.fetch)).listen(44100);

// Bun
Bun.serve({
  port: 44100,
  fetch(request) {
    return router.fetch(request);
  },
});

// Deno
Deno.serve({ port: 44100 }, router.fetch);
```

The router runs middleware and controllers, and requests for `/assets/...` reach a controller action that calls `assets.fetch(request)`.

The rest of this chapter uses the Node entry. In production, Node runs the same source with the [`remix/node-tsx`](https://docs.remix.run/node-tsx/) loader:

```sh
NODE_ENV=production node --import remix/node-tsx server.ts
```

The loader strips types as modules load but doesn't typecheck, so run `npm run typecheck` in CI.

The asset server compiles each browser module the first time it's requested and keeps the result in memory. It reads that source from `app/` and `node_modules`, and its compilers are native packages built for one operating system and CPU. Install dependencies on the machine that serves the app, not on the machine you develop on:

```sh
npm ci --omit=dev
```

<!-- VERIFY: chapter 11's stub says the generated app uses `watch: false`; template/app/assets.ts uses `watch: isDevelopment`. -->

The asset server's options follow `NODE_ENV`. The starter's `app/assets.ts` minifies and stops watching files outside development:

```ts filename=app/assets.ts
const nodeEnv = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnv === "development";

export const assets = createAssetServer({
  // ...
  minify: !isDevelopment,
  watch: isDevelopment,
});
```

[Files and Assets](/guides/files-and-assets/#fingerprinting-source-maps-minification) covers these options and fingerprinting. Put a CDN in front of the app to cache assets, so most asset requests never reach the server.

### Running in a container

Remix apps are often deployed as container images. An image pins the Node version and operating system, installs native dependencies for the machine that runs them, and runs the same way on your machine and on any host that runs containers. Here's a simple `Dockerfile` to start from:

<!-- VERIFY: not built with Docker yet. Same steps run outside a container; shape matches remix-website's Dockerfile (node:24 slim, prod deps in image, USER node, exec-form node --import remix/node-tsx CMD). -->
<!-- VERIFY: node:24-slim tracks the latest Node 24 release (>= 24.3). https://hub.docker.com/_/node -->

```dockerfile filename=Dockerfile
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

EXPOSE 44100
CMD ["node", "--import", "remix/node-tsx", "server.ts"]
```

Add `node_modules` and `.env` to `.dockerignore`, so `COPY . .` doesn't overwrite the image's dependencies with ones built for your machine or copy secrets into the image. The app runs as the image's unprivileged `node` user, and the exec-form `CMD` makes `node` the container's main process, so `SIGTERM` from `docker stop` reaches the server directly instead of going through a shell or `npm`.

<!-- VERIFY: whether `npm start` forwards SIGTERM to node depends on the npm version and how it's invoked. -->

Anything the app writes inside the container, including the SQLite file at `/app/albums.sqlite`, disappears when the container is replaced. [State across processes and deploys](#state-across-processes-and-deploys) covers where that state can live instead.

## How the request URL is built

`createRequestListener(...)` builds `request.url` from the connection Node sees. Behind a proxy that terminates TLS, that's plain HTTP, so the URL starts with `http:` and uses whatever `Host` header arrived. That has consequences further in: session middleware marks cookies `Secure` only when `context.url.protocol` is `https:` (unless the cookie sets `secure` itself), and CSRF middleware compares the browser's `https:` `Origin` with `context.url.origin` and rejects form posts.

Fixed `host` and `protocol` options give the app its public origin, whatever the incoming headers say:

```ts filename=server.ts
// The public URL, such as https://albums.example.com
const origin = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN) : undefined;

const server = http.createServer(
  createRequestListener(router.fetch, {
    host: origin?.host,
    protocol: origin?.protocol,
  }),
);
```

`trustProxy: true` reads `Forwarded` and `X-Forwarded-*` headers instead, which suits an app served under several hostnames. Only enable it when the app is reachable exclusively through a proxy that overwrites those headers. Otherwise clients can spoof the URL and address the app sees. Fixed `host` and `protocol` take precedence over forwarded headers when both are set. [Request Handling](/guides/request-handling/#createrequestlistener) covers the listener's other options.

## Caching and CDNs

The asset server sets its own `Cache-Control`. With fingerprinting, asset URLs include a content hash and get `public, max-age=31536000, immutable`. Without it, URLs are stable and get `no-cache` with an ETag, so browsers revalidate and usually receive `304`. [Files and Assets](/guides/files-and-assets/#fingerprinting-source-maps-minification) shows how to enable fingerprinting.

`staticFiles()` from [`remix/middleware/static`](https://docs.remix.run/middleware/static/) sends a weak ETag and `Last-Modified` for files in `public/`, but no `Cache-Control` unless you pass a `cacheControl` option. Neither `render()` nor session middleware sets `Cache-Control` on HTML, so pages carry whatever the action adds. A page for a signed-in user needs `private` or `no-store` so shared caches don't store it:

```tsx
return context.render(<AlbumEditPage album={album} />, {
  headers: { "Cache-Control": "private, no-store" },
});
```

A page that's the same for every visitor can be held by a CDN with `s-maxage` in `Cache-Control`, or with a `CDN-Cache-Control` header that only shared caches read. Request headers that change a response belong in `Vary`, and `Vary: Cookie` makes a page effectively per-user. For conditional HTML responses, `IfNoneMatch` from [`remix/headers`](https://docs.remix.run/headers/) compares an ETag so the action can return `304`. CDNs layer their own defaults on top of these headers, and many don't cache server responses at all unless told to, so check your CDN's caching docs.

## Compression

`compression()` from [`remix/middleware/compression`](https://docs.remix.run/middleware/compression/) goes near the top of the middleware stack, before `staticFiles()`, so it wraps every response:

```ts filename=app/router.ts lines=[1,2,9]
import zlib from "node:zlib";
import { compression } from "remix/middleware/compression";
import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
// ...

export const router = createRouter({
  middleware: [
    compression({ brotli: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } } }),
    staticFiles("./public", { index: false }),
    // ...
    render({ assets }),
  ],
});
```

It picks Brotli, gzip, or deflate from the request's `Accept-Encoding`. It skips responses whose `Content-Type` doesn't compress well, responses that are already encoded or marked `no-transform`, responses smaller than 1,024 bytes, and responses that serve byte ranges. `staticFiles()` only offers byte ranges for files that don't compress, such as images and video, so text files are still compressed.

HTML and server-sent event responses are flushed after every chunk, so streamed content reaches the browser as it's written. Brotli's default quality is slow to run on every response, so the example lowers it.

## State across processes and deploys

Container platforms often start each deploy on a fresh filesystem, and several instances of the app don't share memory or local disk. Anything kept in memory or written to local disk is lost on the next deploy and invisible to other instances.

Remix's storage packages each offer options of both kinds:

| Concern                                                                       | Local to one process or disk                                                                                                                                                               | Shared across instances                                                                                                                                                                                                                                                                                            | Covered in                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Database ([`remix/data-table`](https://docs.remix.run/data-table/))           | [`remix/data-table/sqlite`](https://docs.remix.run/data-table/sqlite/): a database file                                                                                                    | [`remix/data-table/postgres`](https://docs.remix.run/data-table/postgres/), [`remix/data-table/mysql`](https://docs.remix.run/data-table/mysql/): database servers                                                                                                                                                 | [Data and Validation](/guides/data-and-validation/)             |
| Sessions ([`remix/session`](https://docs.remix.run/session/))                 | [`remix/session-storage/memory`](https://docs.remix.run/session-storage/memory/): lost on restart<br>[`remix/session-storage/fs`](https://docs.remix.run/session-storage/fs/): a directory | [`remix/session-storage/cookie`](https://docs.remix.run/session-storage/cookie/): data in the cookie<br>[`remix/session-storage/redis`](https://docs.remix.run/session-storage/redis/): a Redis server<br>[`remix/session-storage/memcache`](https://docs.remix.run/session-storage/memcache/): a Memcached server | [Auth, Sessions, and Security](/guides/auth-sessions-security/) |
| Uploaded files ([`remix/file-storage`](https://docs.remix.run/file-storage/)) | [`remix/file-storage/memory`](https://docs.remix.run/file-storage/memory/): lost on restart<br>[`remix/file-storage/fs`](https://docs.remix.run/file-storage/fs/): a directory             | [`remix/file-storage/s3`](https://docs.remix.run/file-storage/s3/): AWS S3 or an S3-compatible service                                                                                                                                                                                                             | [Files and Assets](/guides/files-and-assets/)                   |

Local options still work in production when one process serves the app and its files live on a persistent volume, so a SQLite file or a storage directory survives deploys. Once instances run on more than one machine, they need the shared options.

A few of the shared options have limits of their own. Cookie session storage is shared because the browser carries the data, so a session can't grow past the browser's cookie size limit, typically 4 KB. Memcache session storage uses TCP sockets and requires Node.js. PostgreSQL and MySQL hold a database lock while `db.migrate(...)` runs, so processes that start at the same time don't apply a migration twice. SQLite has no such lock, so only one process should run its migrations.

The asset server's compiled modules aren't shared either. Each process compiles what it serves, and instances running the same files produce the same fingerprinted URLs.

## Shutting down

A deploy replaces running processes. The platform sends `SIGTERM`, waits a fixed time, then sends `SIGKILL`. The starter's `server.ts` handles `SIGTERM` by closing every connection right away, which is fine in development but drops any request still in progress during a deploy.

To let those requests finish, close the server first and force the remaining connections closed only after a timeout:

```ts filename=server.ts
// Keep this below the platform's SIGTERM-to-SIGKILL window.
const shutdownTimeout = 10_000;
let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  let forceClose = setTimeout(() => server.closeAllConnections(), shutdownTimeout);
  forceClose.unref();

  server.close(async () => {
    clearTimeout(forceClose);
    await db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

`server.close(...)` stops accepting connections and runs its callback once the open ones finish, then the database client closes as [Data and Validation](/guides/data-and-validation/#create-the-tables-with-sql) describes. How long the platform waits before `SIGKILL` varies from about a second to a time you configure, so `shutdownTimeout` has to fit inside it. [What Remix needs from a runtime](#what-remix-needs-from-a-runtime) notes the window for some platforms.

## What Remix needs from a runtime

Remix is runtime-agnostic. Routes, controllers, and middleware run anywhere that can call `router.fetch(...)`: Node through [`remix/node-fetch-server`](https://docs.remix.run/node-fetch-server/), and runtimes that accept a Fetch handler directly, such as Bun and Deno, as [Request Handling](/guides/request-handling/#alternate-runtimes-bun-deno-workers) shows.

<!-- VERIFY: whether remix/assets (native oxc/lightningcss bindings, node: APIs) runs under Bun or Deno is unconfirmed. -->

The rest of the app asks more of a runtime. The sections above rely on a filesystem holding the source and `node_modules`, on Node-compatible native packages for the asset server, and on a process that starts, serves requests, and receives a signal before it stops. Platforms differ in how much of that they provide.

### Long-lived Node processes

<!-- VERIFY: Railway injects PORT, runs the start script, health-checks only at deploy, SIGKILLs after RAILWAY_DEPLOYMENT_DRAINING_SECONDS. https://docs.railway.com/deployments/healthchecks -->
<!-- VERIFY: Railway's edge sends X-Forwarded-Proto, X-Forwarded-Host, X-Real-IP; X-Forwarded-For isn't documented. https://docs.railway.com/networking/public-networking/specs-and-limits -->

A VPS, a container platform, or a service like Railway provides all three, so the app runs as written on Node.js 24.3 or later, listening on the platform's `PORT`. Railway, for example, runs the `start` script, can wait for a health check route before switching traffic, and sends `SIGTERM` before a [draining time](https://docs.railway.com/deployments/deployment-teardown) you configure. Its edge [sends `X-Real-IP`](https://docs.railway.com/networking/public-networking/specs-and-limits) rather than `X-Forwarded-For`, so the client address `trustProxy` reports would be the proxy's, while fixed `host` and `protocol` options still produce the right URL.

### Serverless platforms that ship the whole project

<!-- VERIFY: Vercel Container Runtime is Beta, listens on 80 or PORT, 30s after SIGTERM. https://vercel.com/docs/functions/runtimes/container -->
<!-- VERIFY: Lambda Web Functions: zip, nodejs24.x, listen on AWS_LAMBDA_HTTP_ENDPOINT, 512 MB unzipped, up to 1s after SIGTERM. https://docs.aws.amazon.com/lambda/latest/dg/web-functions-runtimes.html -->

Some serverless platforms run a server from an image or archive that holds the source and `node_modules`. [Vercel's container runtime](https://vercel.com/docs/functions/runtimes/container) (beta) runs a `Dockerfile` like the one above on port 80 or `PORT`, and allows 30 seconds after `SIGTERM`. AWS Lambda can run a [container image](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html) behind a Function URL with an adapter around `router.fetch(...)`, or a [Lambda Web Function](https://docs.aws.amazon.com/lambda/latest/dg/web-functions-runtimes.html) that listens on `AWS_LAMBDA_HTTP_ENDPOINT` and gets up to 1 second after `SIGTERM`.

<!-- VERIFY: production node_modules is tens of MB (about 49 MB for remix@3.1.0 on macOS arm64); varies by OS/CPU. -->

Instances on these platforms start and stop often, so cold starts recompile assets and the shutdown window can be short. The production install is tens of megabytes, a large share of it native binaries, which counts against package size limits. A platform that requires a JavaScript entry file can load the TypeScript loader first and then import the server, or run with `NODE_OPTIONS="--import remix/node-tsx"`:

<!-- VERIFY: index.js and NODE_OPTIONS approaches start server.ts on Node 24 locally; not run on a serverless platform. -->

```js filename=index.js
import "remix/node-tsx";

await import("./server.ts");
```

The import of `server.ts` has to be dynamic. Static imports are all loaded before any module runs, so the loader wouldn't be registered in time.

### Runtimes that need a bundle

<!-- VERIFY: Netlify Functions are bundled at build; Edge Functions run on Deno (20 MB, 50 ms CPU). https://docs.netlify.com/build/functions/overview/ https://docs.netlify.com/build/edge-functions/limits/ -->
<!-- VERIFY: Vercel standard functions trace imports into the bundle (includeFiles adds more), so dynamically read assets are likely missing. https://vercel.com/docs/project-configuration/vercel-json -->

Cloudflare Workers, [Netlify Functions and Edge Functions](https://docs.netlify.com/build/functions/overview/), and most likely Vercel's standard functions run code bundled at deploy time. [`remix/assets`](https://docs.remix.run/assets/) can't run there: it reads source files from disk when a request arrives and compiles them with native packages that expect Node. Bundling the starter for Workers fails at build time:

<!-- VERIFY: abbreviated from `wrangler deploy --dry-run` (wrangler 4.153.0, remix 3.1.0). -->

```txt
✘ [ERROR] Could not resolve "@oxc-parser/binding-wasm32-wasi"
✘ [ERROR] Could not resolve "@oxc-transform/binding-wasm32-wasi"
▲ [WARNING] The glob pattern require("../lightningcss.*.node") did not match any files
```

Remix targets runtimes that can serve browser source from disk. Where a platform can't, a bundler is something you add and own. Routes, controllers, middleware, and `router.fetch(...)` stay the same. What changes:

<!-- VERIFY: Workers enable Node.js compatibility by default for compatibility dates on/after 2026-08-04; older dates need nodejs_compat. https://developers.cloudflare.com/workers/runtime-apis/nodejs/ -->
<!-- VERIFY: `import { env } from "cloudflare:workers"` exposes bindings at module scope. -->

- **Entry:** the module default-exports `{ fetch: router.fetch }` instead of starting `node:http`.
- **Assets:** the bundler emits fingerprinted client files and a manifest. `render({ assets })` only calls `getScriptEntry(entryId)` and expects `{ href, importMap, preloads }`, so an object backed by the manifest can stand in for the asset server.
- **Static files and compression:** the platform serves `public/` and the built assets, and compresses responses.
- **Server output:** the server bundle and its source map stay out of the directory the platform publishes.
- **Configuration:** values come from platform bindings, such as `import { env } from "cloudflare:workers"`, instead of `process.env`.
- **Storage:** the database driver and session and upload storage have to work in that runtime.
- **Node APIs:** Workers provide [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) by default for recent compatibility dates; older ones need the `nodejs_compat` flag.

A site with no per-request behavior can skip the server entirely: a script can crawl the app through `router.fetch(...)`, write each response and the asset URLs it references to files, and upload them to a static host.
