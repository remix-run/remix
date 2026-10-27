---
title: Production
description: Run a Remix app in production, from the start command and configuration to the server entry, deploys, caching, and running more than one instance.
---

A Remix app has no build step. Production runs the same source you develop, with `NODE_ENV=production` and a server entry that's ready for real traffic. This chapter covers what changes in production and what to set up, with examples drawn from the albums app.

The examples use Node because the starter runs on Node and it's the shortest path to a deploy. Nothing in your routes, controllers, or middleware depends on Node, though. Bun and Deno [run the same app](#bun-and-deno) too.

## Run the app in production mode

The starter's `start` script runs the server in production mode:

```sh
npm start
```

That runs `NODE_ENV=production node --import remix/node-tsx server.ts`. The [`remix/node-tsx`](https://docs.remix.run/node-tsx/) loader strips types and compiles JSX as modules load. It doesn't typecheck, so run `npm run typecheck` and your tests in CI before you deploy. The starter requires Node.js 24.3 or later, as the `engines` field in `package.json` says, so make sure the production machine or image runs a matching version.

`NODE_ENV` decides how the starter's `app/assets.ts` configures the asset server from [`remix/assets`](https://docs.remix.run/assets/):

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

In production, the asset server minifies modules, stops watching files, and fingerprints asset URLs with a hash of their content. The browser entry is served from a URL like `/assets/app/actions/public/entry.@vUxLei.ts` instead of `/assets/app/actions/public/entry.ts`. Changing a file changes its URL, so browsers and CDNs can cache each asset for a year without checking back. If `NODE_ENV` isn't set, the app runs as it does in development, watching files and serving assets that browsers have to revalidate.

The asset server compiles each browser module the first time it's requested and keeps the result in memory, so there's nothing to build before a deploy. [Files and Assets](/files-and-assets/) covers the asset server's other options.

### Install dependencies where the app runs

The compilers behind [`remix/node-tsx`](https://docs.remix.run/node-tsx/) and [`remix/assets`](https://docs.remix.run/assets/) are native packages, built for one operating system, CPU, and C library. A `node_modules` directory installed on a Mac won't run on a Linux server, so install dependencies on the machine or in the image that runs the app:

```sh
npm ci --omit=dev
```

## Configuration and secrets

Production configuration usually comes from environment variables. It's a good idea to read them in one module and check them at startup, so a misconfigured deploy fails right away. A [`remix/data-schema`](https://docs.remix.run/data-schema/) schema can do the checking and parsing:

```ts filename=app/config.ts
import * as s from "remix/data-schema";
import { url } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";

const Port = s.defaulted(coerce.number(), 44100);
// The public URL, such as https://albums.example.com
const Origin = s
  .string()
  .pipe(url())
  .transform((value) => new URL(value));
// Comma-separated, newest first
const Secrets = s.string().transform((value) => value.split(","));

// Only local development and tests get placeholder values.
const isLocal = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

const Env = isLocal
  ? s.object({
      PORT: Port,
      APP_ORIGIN: s.optional(Origin),
      SESSION_SECRETS: s.defaulted(Secrets, ["development-secret"]),
    })
  : s.object({ PORT: Port, APP_ORIGIN: Origin, SESSION_SECRETS: Secrets });

let result = s.parseSafe(Env, process.env);
if (!result.success) {
  let problems = result.issues.map((issue) => `${issue.path?.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment:\n${problems.join("\n")}`);
}

export const { PORT: port, APP_ORIGIN: appOrigin, SESSION_SECRETS: sessionSecrets } = result.value;
```

The starter's `dev` and `test` scripts set `NODE_ENV`, so they keep working without these variables. Anywhere else, including a deploy that forgets `NODE_ENV=production`, the app refuses to start rather than sign cookies with a placeholder secret.

Hosting platforms let you set environment variables in their dashboard or CLI. On a server you manage, Node can load them from a file with `node --env-file=.env --import remix/node-tsx server.ts`. Either way, keep `.env` files out of git and out of container images.

Session secrets need particular care. Every instance has to use the same secrets, and they have to stay the same across deploys. Otherwise a cookie signed by one process is rejected by the next, and users are signed out. [Auth, Sessions, and Security](/auth-sessions-security/#cookie-configuration-and-secret-rotation) covers signing cookies and rotating secrets.

## A production server entry

`server.ts` connects the router to Node's HTTP server with `createRequestListener()` from [`remix/node-fetch-server`](https://docs.remix.run/node-fetch-server/). In production, it's also where the app sets its public URL, reports errors, tunes timeouts, and shuts down cleanly. Here's a production `server.ts`, leaving out the starter's HMR code:

```ts filename=server.ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { assets } from "./app/assets.ts";
import { appOrigin, port } from "./app/config.ts";
import { db } from "./app/db.ts";
import { router } from "./app/router.ts";

// Keep this below the platform's SIGTERM-to-SIGKILL window.
const shutdownTimeout = 10_000;

const server = http.createServer(
  createRequestListener(router.fetch, {
    host: appOrigin?.host,
    protocol: appOrigin?.protocol,
    onError(error) {
      // Send the error to your error reporting service here.
      console.error(error);
    },
  }),
);

// Keep idle connections open longer than the load balancer does.
server.keepAliveTimeout = 65_000;

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  let forceClose = setTimeout(() => server.closeAllConnections(), shutdownTimeout);
  forceClose.unref();

  server.close(async () => {
    clearTimeout(forceClose);
    await assets.close();
    await db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

The imports check the configuration and create the database client and asset server before `server.listen(...)` runs, so a bad deploy fails before it takes traffic. The sections below walk through each piece.

### The public URL

Most production apps sit behind a proxy or load balancer that handles TLS and forwards plain HTTP. Without the `host` and `protocol` options, `request.url` would start with `http:` and use whatever `Host` header the proxy sent. Two parts of Remix depend on that URL. Session middleware from [`remix/middleware/session`](https://docs.remix.run/middleware/session/) marks cookies `Secure` only when the URL is `https:`, and CSRF middleware from [`remix/middleware/csrf`](https://docs.remix.run/middleware/csrf/) rejects form posts whose `Origin` doesn't match the URL's origin.

Fixed `host` and `protocol` options give every request the app's public origin, here from the `appOrigin` in `app/config.ts`:

```ts filename=server.ts
const server = http.createServer(
  createRequestListener(router.fetch, {
    host: appOrigin?.host,
    protocol: appOrigin?.protocol,
  }),
);
```

If the app is served under several hostnames, use `trustProxy: true` instead, which reads the `Forwarded` and `X-Forwarded-*` headers. Only enable it when every request passes through a proxy that overwrites those headers. Otherwise clients can spoof the URL and the client address the app sees. If Node handles TLS itself, create the server with `node:https` instead, and request URLs start with `https:` on their own. [Request Handling](/request-handling/#createrequestlistener) covers the listener's options.

### Errors and logs

When an action or middleware throws, the listener calls `onError` and sends a generic `500` response, so no error details reach the browser. Use `onError` to send errors to an error reporting service:

```ts filename=server.ts
createRequestListener(router.fetch, {
  // ...
  onError(error) {
    // Send the error to your error reporting service here.
    console.error(error);
  },
});
```

`onError` only sees errors thrown before a response starts. Errors elsewhere have their own hooks, so wire each one to the same reporting service:

- **Streamed pages:** once HTML has started streaming, render errors go to the `onError` option of `render()` from [`remix/middleware/render`](https://docs.remix.run/middleware/render/).
- **Browser modules:** compilation errors in the asset server go to its `onError` option.
- **The browser:** hydration and component errors are `error` events on the runtime returned by `run()`, as [Interactivity](/interactivity/#browser-entry-with-run) shows.

[Errors and Cancellation](/errors-and-cancellation/) covers what each one receives.

When a client disconnects, the listener aborts `request.signal`, and `render()` stops rendering. Pass `request.signal` to other slow work, such as `fetch()` calls to other services, so it stops too. The listener doesn't report these aborts to `onError`, and your own code should treat them the same way: as expected cancellation, not as errors to report.

For a log line per request, add `logger()` from [`remix/middleware/logger`](https://docs.remix.run/middleware/logger/) at the top of the router's middleware. It writes to standard output, which is where most platforms collect logs. Remix doesn't include metrics or tracing. Middleware at the top of the stack sees every request and response, so it's a natural place to add them.

### Timeouts

Node closes an idle keep-alive connection after 5 seconds. Load balancers usually keep idle connections open longer, often 60 seconds, and when Node closes one first, the load balancer can send a request into a closed connection and return a `502`. Setting `keepAliveTimeout` above the load balancer's idle timeout avoids that. Check your platform's value:

```ts filename=server.ts
server.keepAliveTimeout = 65_000;
```

### Shutting down

A deploy replaces running processes. The platform sends `SIGTERM`, waits a fixed time, then sends `SIGKILL`. To let requests in progress finish, close the server first and force the remaining connections closed only after a timeout:

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
    await assets.close();
    await db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

`server.close(...)` stops accepting new connections and runs its callback once the open ones finish, so requests in progress complete before the asset server and database close.

Responses that never finish on their own, such as server-sent events, hold their connections open until `shutdownTimeout` forces them closed. Those requests' `request.signal` aborts at that point, so handlers can stop work, as [Errors and Cancellation](/errors-and-cancellation/#aborts-request-signal-and-the-router) describes.

How long the platform waits before `SIGKILL` ranges from about a second to a time you configure, so set `shutdownTimeout` to fit inside it.

### Health checks

Load balancers and deploy tools check a URL to decide whether an instance can take traffic. Add a route that returns `200`:

```ts filename=app/routes.ts lines=[3]
export const routes = route({
  assets: get("/assets/*path"),
  health: get("/health"),
  // ...
});
```

```tsx filename=app/actions/controller.tsx
health() {
  return new Response("ok");
},
```

If the app can't serve anything without its database, the action can run a cheap query and return `503` when it fails.

### Keeping the process running

Node exits when an exception isn't handled. Let it, and have something restart the process. Container platforms do this for you. On a server you manage, run the app under a service manager such as systemd, which restarts it after a crash and starts it when the machine boots. A Node process runs JavaScript on one CPU core, so to use more cores, [run several processes](#running-more-than-one-instance).

## Deploying

A deploy installs dependencies, applies database migrations, and starts the server:

```sh
npm ci --omit=dev
npx remix db migrate
npm start
```

[Data and Validation](/data-and-validation/#create-the-tables-with-sql) runs migrations when the server starts, which works for a single process. Once several processes start at the same time, run migrations once per deploy, before the new processes take traffic. Most platforms have a release or pre-deploy command for this. [`remix db migrate`](https://docs.remix.run/cli/) reads the database and migrations directory from `remix.json`:

```jsonc filename=remix.json
{
  "db": {
    "adapter": { "type": "sqlite", "filename": "./albums.sqlite", "foreignKeys": true },
    "migrations": { "directory": "./db/migrations" },
  },
}
```

For PostgreSQL, the adapter reads the connection string from the environment with `{ "type": "postgres", "connectionString": { "env": "DATABASE_URL" } }`. The [Remix CLI docs](https://docs.remix.run/cli/) cover the other `remix db` commands.

### Running in a container

Container images are a common way to ship a Remix app. An image pins the Node version and operating system, installs native dependencies for the machine that runs them, and runs the same way on your machine and on any host that runs containers:

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

Add `node_modules`, `.env`, `.git`, and local database files to `.dockerignore`, so `COPY . .` doesn't overwrite the image's dependencies with ones built for your machine or copy secrets into the image. The app runs as the image's unprivileged `node` user. The exec-form `CMD` makes `node` the container's main process, so `SIGTERM` reaches the server directly instead of going through a shell or `npm`.

Anything the app writes inside the container, including a SQLite file, disappears when the container is replaced. Put it on a persistent volume, or use [storage shared across instances](#running-more-than-one-instance).

## Caching and compression

**Assets.** With fingerprinting, the asset server sends `Cache-Control: public, max-age=31536000, immutable`, so put a CDN in front of the app and most asset requests never reach the server.

**Files in `public/`.** `staticFiles()` from [`remix/middleware/static`](https://docs.remix.run/middleware/static/) sends an ETag and `Last-Modified` but no `Cache-Control`, and without one, browsers guess how long to cache a file from its age. Set the policy yourself, with `CacheControl` from [`remix/headers`](https://docs.remix.run/headers/):

```ts filename=app/router.ts
import { CacheControl } from "remix/headers";

export const router = createRouter({
  middleware: [
    staticFiles("./public", {
      index: false,
      cacheControl: new CacheControl({ public: true, maxAge: 3600 }).toString(),
    }),
    // ...
  ],
});
```

**Pages.** Nothing in Remix sets `Cache-Control` on HTML, so pages carry whatever the action adds. A page for a signed-in user needs `private` so shared caches don't store it:

```tsx
import { CacheControl } from "remix/headers";

// ...

return context.render(<AlbumEditPage album={album} />, {
  headers: { "Cache-Control": new CacheControl({ private: true, noCache: true }).toString() },
});
```

A page that's the same for every visitor can be cached by a CDN with `s-maxage`, or with a `CDN-Cache-Control` header that only shared caches read. Never let a shared cache store a response that sets a cookie, because the next visitor would receive it. Session middleware can add `Set-Cookie` to any response, so cache only pages that don't touch the session. CDNs apply their own defaults on top of these headers, so check your CDN's caching docs.

When a response depends on a request header, such as `Accept-Language`, list that header in `Vary` so caches keep a separate copy for each value. `compression()` adds `Accept-Encoding` for you. Avoid `Vary: Cookie`, which gives every visitor their own copy and leaves little for a shared cache to reuse. For pages that rarely change, an `ETag` lets browsers revalidate cheaply: compare it with `IfNoneMatch` from `remix/headers` and return `304 Not Modified` when it matches.

**Compression.** If a proxy, CDN, or platform in front of the app compresses responses, let it. Otherwise add `compression()` from [`remix/middleware/compression`](https://docs.remix.run/middleware/compression/) near the top of the middleware stack, before `staticFiles()`, so it wraps every response:

```ts filename=app/router.ts
import zlib from "node:zlib";
import { compression } from "remix/middleware/compression";

export const router = createRouter({
  middleware: [
    compression({ brotli: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } } }),
    staticFiles("./public", { index: false }),
    // ...
  ],
});
```

Brotli's default quality is too slow to run on every response, so the example lowers it. `compression()` negotiates Brotli, gzip, or deflate from `Accept-Encoding`, and flushes HTML and server-sent events as they stream. It leaves alone responses it would break or barely shrink: ones that are already encoded, marked `no-transform`, smaller than 1 KB, or of a type that doesn't compress well, plus byte-range responses. `staticFiles()` only offers byte ranges for files that don't compress, such as video, so seeking in media keeps working while text files are still compressed.

## Running more than one instance

Several instances of the app don't share memory or local disk, and container platforms often start each deploy on a fresh filesystem. Anything kept in memory or on local disk is invisible to other instances and lost on the next deploy. Remix's storage packages offer options of both kinds. Memory storage is also lost whenever the process restarts:

| Storage                                                                                                        | Local to one process or disk                                                                                   | Shared across instances                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Database](/data-and-validation/), from [`remix/data-table`](https://docs.remix.run/data-table/)        | [`sqlite`](https://docs.remix.run/data-table/sqlite/)                                                          | [`postgres`](https://docs.remix.run/data-table/postgres/), [`mysql`](https://docs.remix.run/data-table/mysql/)                                                                       |
| [Sessions](/auth-sessions-security/), from [`remix/session`](https://docs.remix.run/session/)           | [`memory`](https://docs.remix.run/session-storage/memory/), [`fs`](https://docs.remix.run/session-storage/fs/) | [`cookie`](https://docs.remix.run/session-storage/cookie/), [`redis`](https://docs.remix.run/session-storage/redis/), [`memcache`](https://docs.remix.run/session-storage/memcache/) |
| [Uploaded files](/files-and-assets/), from [`remix/file-storage`](https://docs.remix.run/file-storage/) | [`memory`](https://docs.remix.run/file-storage/memory/), [`fs`](https://docs.remix.run/file-storage/fs/)       | [`s3`](https://docs.remix.run/file-storage/s3/)                                                                                                                                      |

Local options still work when one process serves the app and its files live on a persistent volume. Once instances run on more than one machine, they need the shared options. Cookie session storage is shared because the browser carries the data, so a session can't grow past the browser's cookie size limit, typically 4 KB.

A few other things have to line up across instances:

- **Secrets.** Every instance signs cookies with the same `SESSION_SECRETS`.
- **Migrations.** [Run them once per deploy](#deploying). PostgreSQL and MySQL also hold a lock while migrations run, so two processes can't apply the same migration. SQLite has no such lock.
- **Assets.** Each process compiles the modules it serves, and instances running the same files produce the same fingerprinted URLs.

While a deploy is in progress, old and new instances serve traffic at the same time. A page rendered by a new instance can request an asset URL that an old instance doesn't serve, and the old instance returns `404`. The same happens when a browser tab opened before the deploy loads a module afterward. A CDN that has already cached an asset keeps serving it, which hides most of these failures. Deploys that switch all traffic to the new version at once leave only the open tabs.

## Other runtimes and platforms

The router is a Fetch handler, so the server entry is the only file that changes from one runtime to another.

### Bun and Deno

<!-- VERIFY: tested with the template inside the monorepo (Bun 1.3.0, Deno 2.5.6, NODE_ENV=production): pages render, fingerprinted assets compile and serve. Not tested from a standalone install; Deno's minimal permission set is unconfirmed. -->

Bun and Deno accept Fetch handlers directly and run TypeScript and JSX themselves, so they don't need [`remix/node-fetch-server`](https://docs.remix.run/node-fetch-server/) or [`remix/node-tsx`](https://docs.remix.run/node-tsx/):

```ts filename=server.ts
import { router } from "./app/router.ts";

// Bun: bun server.ts
Bun.serve({ port: 44100, fetch: (request) => router.fetch(request) });

// Deno: deno run -A server.ts
Deno.serve({ port: 44100 }, router.fetch);
```

The asset server, routes, controllers, and middleware run unchanged. Port the production concerns above to the runtime's server API: the public URL, error reporting, and graceful shutdown with `server.stop()` in Bun or `server.shutdown()` in Deno. [Request Handling](/request-handling/#alternate-runtimes-bun-deno-workers) covers these entries.

### Hosting platforms

Everything in this chapter assumes a process that starts, serves requests from a filesystem holding the source and `node_modules`, and receives `SIGTERM` before it stops. A VPS or container platform provides all of that, so the app runs as written. From the platform, find out:

- which environment variable holds the port, usually `PORT`
- how long it waits between `SIGTERM` and `SIGKILL`
- which headers its proxy sends, and its idle connection timeout
- where to configure a health check and a release command for migrations

Some serverless platforms also run a full server from a container image or an archive of the project. The app works there too, but instances start and stop often, so cold starts recompile assets and the shutdown window can be short. A platform that needs a JavaScript entry file can load the TypeScript loader first and then import the server:

<!-- VERIFY: index.js approach starts server.ts on Node 24 locally; not run on a serverless platform. -->

```js filename=index.js
import "remix/node-tsx";

await import("./server.ts");
```

The import of `server.ts` has to be dynamic, because static imports load before any module runs, before the loader is registered.

> [!TIP]
> **Deploying to Cloudflare Workers, Netlify, or Vercel Functions**
>
> These platforms bundle your code at deploy time and don't keep your source or `node_modules` on disk. The asset server from [`remix/assets`](https://docs.remix.run/assets/) can't run there, because it reads browser source from disk and compiles it with native packages when a request arrives. Instead, a bundler builds the browser code ahead of time and the platform serves the output as static files. Routes, controllers, and middleware stay the same.
>
> Remix itself doesn't depend on a bundler. The community-maintained [Pitlane](https://pitlane.tools/guides) project provides a Vite plugin for Remix and deployment guides for [Cloudflare Workers](https://pitlane.tools/deploy/cloudflare), [Netlify](https://pitlane.tools/deploy/netlify), and [Vercel](https://pitlane.tools/deploy/vercel).
>
> With any bundler, the rest of the app has to fit the runtime too. `staticFiles()`, `loadMigrations(...)` from [`remix/data-table/migrations/node`](https://docs.remix.run/data-table/migrations/node/), and the `fs` storage options read local disk while the app runs, so use the platform's storage and run migrations as a deploy step. Configuration comes from platform bindings, such as `import { env } from "cloudflare:workers"`, instead of `process.env`.

## Production checklist

- [ ] The server runs Node.js 24.3 or later with `NODE_ENV=production`, so assets are minified and fingerprinted.
- [ ] Dependencies are installed on the platform that runs the app, and CI runs the typecheck and tests.
- [ ] Required environment variables are checked at startup, and no `.env` file is committed or copied into an image.
- [ ] Session secrets are the same on every instance and stay the same across deploys.
- [ ] The server has the app's public origin, from `host` and `protocol` or from a trusted proxy.
- [ ] Server, render, asset, and browser errors all reach your error reporting, and logs go to standard output.
- [ ] `keepAliveTimeout` is longer than the load balancer's idle timeout.
- [ ] Shutdown lets requests finish within the platform's `SIGTERM` window.
- [ ] A health check route returns `200`.
- [ ] Migrations run once per deploy.
- [ ] Sessions, uploads, and the database use shared storage when more than one instance runs.
- [ ] Files in `public/` and signed-in pages send deliberate `Cache-Control` headers.
- [ ] Responses are compressed once, by the app or by the proxy in front of it.
- [ ] After each deploy, a request to the public URL loads a page and its assets.
