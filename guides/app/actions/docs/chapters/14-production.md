---
title: Production
description: How to configure, start, cache, observe, and shut down a Remix application in production.
---

A production Remix app is still the request path from the first chapter: a runtime adapter turns an incoming request into a Web `Request`, the router returns a Web `Response`, and the adapter writes it back. Deployment work makes the surrounding choices explicit—configuration, durable services, proxy trust, caches, reporting, health, and shutdown.

There is no separate production application architecture. There are, however, several development defaults that should not be mistaken for a multi-replica deployment plan.

## Run the generated Node server {#production-server}

The generated start script runs TypeScript source in production mode:

```json filename=package.json
{
  "scripts": {
    "start": "NODE_ENV=production node --import remix/node-tsx server.ts"
  },
  "engines": {
    "node": ">=24.3.0"
  }
}
```

`server.ts` creates a Node HTTP server and adapts it to the router:

```ts filename=server.ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { reportError } from "./app/errors.ts";
import { router } from "./app/production-router.ts";

function handleServerError(error: unknown) {
  reportError(error, { boundary: "node-adapter" });

  return new Response("Internal Server Error", {
    status: 500,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

let server = http.createServer(
  createRequestListener((request) => router.fetch(request), {
    onError: handleServerError,
  }),
);

server.listen(44100);
```

Keep this server when the deployment runs a long-lived Node process or container. A platform that invokes Fetch handlers directly, runs another JavaScript runtime, or owns its socket lifecycle needs the corresponding adapter around the same `router.fetch()` boundary. Do not put Node request and response objects into controllers merely because one deployment starts with Node.

The `remix/node-tsx` loader transforms source at runtime and does not typecheck it. Run `npm run typecheck` and tests before deploying, not on the first production request.

## Validate environment variables and secrets at startup {#environment-variables-and-secrets}

The session and asset modules from earlier chapters already reject a missing `SESSION_SECRET` or production `RELEASE_ID` when they are imported. Keep those checks at the modules that consume the values. Add the server-owned public origin and port to a small configuration module:

```ts filename=app/config.ts
function required(name: string, testValue?: string): string {
  let value =
    process.env[name]?.trim() ||
    (process.env.NODE_ENV === "test" ? testValue : undefined);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function origin(name: string, testValue?: string): URL {
  let value = new URL(required(name, testValue));
  if (
    value.username ||
    value.password ||
    value.pathname !== "/" ||
    value.search ||
    value.hash
  ) {
    throw new Error(
      `${name} must be an origin without credentials, a path, or a query`,
    );
  }
  return new URL(value.origin);
}

function port(name: string, fallback: number): number {
  let raw = process.env[name];
  if (raw === undefined) return fallback;

  let value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer from 1 to 65535`);
  }
  return value;
}

export const config = Object.freeze({
  origin: origin("APP_ORIGIN", "https://albums.test"),
  port: port("PORT", 44100),
});

if (
  config.origin.protocol !== "https:" &&
  process.env.NODE_ENV === "production"
) {
  throw new Error("APP_ORIGIN must use HTTPS in production");
}
```

The auth module from [Auth, Sessions, and Security](/auth-sessions-security/) performed this same `APP_ORIGIN` validation inline. Now that a configuration module owns that parse, consume it there so the origin is validated once:

```ts filename=app/auth.ts
// Replace the appOrigin parsing added in the auth chapter. requiredEnv
// stays for the provider credentials; the Google redirectUri keeps
// resolving against this value.
import { config } from "./config.ts";

let appOrigin = config.origin;
```

Database and storage URLs, provider credentials, and encryption keys belong at the startup boundary of the module that constructs that service. Validate values, not only presence: a path-bearing public origin and `PORT=not-a-number` should not become running configuration. The session module's byte-length check rejects obviously weak secrets, but deployment tooling should still generate them from a cryptographically secure random source.

Never fall back to a demo session secret outside tests. Treat secret rotation as a security operation: routine rotation may temporarily accept an old validated key, while a compromised key must be removed immediately even though that invalidates sessions signed with it.

Pass public configuration to browser code intentionally. Do not serialize `process.env` into the document or asset source.

## Configure hosts, TLS, and trusted proxies {#trusted-proxies}

`createRequestListener()` derives the request URL from the connection and `Host` header by default. A deployment with fixed public values can override them:

```ts
createRequestListener(handler, {
  host: config.origin.host,
  protocol: config.origin.protocol,
});
```

Treat the incoming `Host` header as untrusted unless the network path validates it. An attacker-controlled host can otherwise affect absolute redirects, OAuth callbacks, and same-origin checks. Fixed `host` and `protocol` values remove that ambiguity for a single-origin deployment.

Behind a trusted reverse proxy, Remix can use `Forwarded`, `X-Forwarded-Host`, `X-Forwarded-Proto`, and forwarded client address information:

```ts
createRequestListener(handler, { trustProxy: true });
```

This is an all-or-nothing boolean, not a proxy-hop allowlist. Enable it only when the app process cannot be reached except through infrastructure that removes untrusted forwarded headers and writes its own. Otherwise a direct client can spoof the scheme, host, or address used for redirects, secure-origin checks, and logs.

Terminate TLS at the app or a trusted proxy. When the proxy terminates TLS, make sure the app still sees the correct public HTTPS origin before enabling secure cookies or generating absolute callback URLs.

## Initialize before listening, then shut down once {#startup-and-shutdown}

Run schema changes as a one-shot release command before starting application replicas:

```ts filename=scripts/migrate.ts
import "../app/data/migrate.ts";
```

```sh
NODE_ENV=production node --import remix/node-tsx scripts/migrate.ts
```

Keep readiness in a small app-owned module that startup, shutdown, and the health responder can share:

```ts filename=app/readiness.ts
let ready = false;

export function isReady(): boolean {
  return ready;
}

export function markReady(value: boolean): void {
  ready = value;
}
```

Start listening only after required in-process initialization, then await the actual listening event before marking the instance ready. Replace the earlier `server.listen(44100)` call with this startup block; do not keep both calls:

```ts filename=server.ts
import { once } from "node:events";

import { config } from "./app/config.ts";
import { markReady } from "./app/readiness.ts";

// In the existing server startup, after required initialization:
server.listen(config.port);
await once(server, "listening");
markReady(true);

console.log(`Server listening on ${config.origin.origin}`);
```

Running migrations in every replica at once is not a general deployment strategy. Prefer a one-shot release job, an init task, or a leader/lock mechanism supported by the database. Start application replicas only after that step succeeds. Design rolling migrations with an expand-and-contract sequence: deployed versions must tolerate the schema seen while old and new replicas overlap.

Shutdown should stop new connections, allow active work to finish during the platform's grace period, and force-close only after the deadline:

```ts filename=server.ts
import { assetServer } from "./app/assets.ts";
import { sqlite } from "./app/data/database.ts";

// In the existing server module, after server creation:
let shuttingDown = false;
const forceCloseAfterMs = 8_000;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  markReady(false);
  console.log(`Received ${signal}; draining requests`);

  let forceTimer = setTimeout(() => {
    console.error("Shutdown deadline exceeded; closing active connections");
    server.closeAllConnections();
  }, forceCloseAfterMs);
  forceTimer.unref();

  let drainResult = await Promise.allSettled([
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  ]);

  let cleanupResult = await Promise.allSettled([
    Promise.resolve().then(() => assetServer.close()),
    Promise.resolve().then(() => sqlite.close()),
  ]);

  clearTimeout(forceTimer);

  for (let result of [...drainResult, ...cleanupResult]) {
    if (result.status === "rejected") {
      console.error(result.reason);
      process.exitCode = 1;
    }
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
```

Calling `closeAllConnections()` immediately after `server.close()` terminates the requests that were supposed to drain. With a ten-second platform grace period, this example's eight-second force-close point reserves the remaining time for resource cleanup.

Set the force-close point from the deployment's real termination window. The once guard prevents a second signal from racing another cleanup sequence. Wrapping each close call in a promise turns synchronous throws into settled cleanup failures too.

Close only resources this process owns. This album app closes its asset server and SQLite handle; an app that owns a PostgreSQL pool or Redis client would settle `pool.end()` or `redis.quit()` here too. A platform-managed connection or request lifecycle may have a different shutdown hook than a long-lived Node server.

## Choose process-safe storage {#process-safe-storage}

The right storage follows the request across every process that may receive it:

| State           | Development option                  | Multi-replica production option                                                               |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| Session records | memory or dedicated local directory | Redis, Memcache, database, or another shared store with expiry                                |
| Album covers    | local `FileStorage`                 | S3-compatible/object storage or a deployment-provided shared service                          |
| Transform cache | process memory                      | shared cache only when its keys include build/config identity                                 |
| Database        | local SQLite file                   | deployment-specific durable database, or one-node persistent SQLite with an explicit topology |

Process memory disappears on restart and differs between replicas. A local path lives inside one filesystem unless the platform explicitly guarantees persistent shared storage. Sticky sessions may hide the problem temporarily but do not make process-local auth or uploads durable.

Choose storage semantics as well as a product name: expiry, revocation, atomic writes, encryption, backup, consistency, and cleanup still belong to the app's deployment design.

## Assign cache policy by response type {#caching}

Cache policy belongs on each representation:

| Response                               | Typical starting policy                                  |
| -------------------------------------- | -------------------------------------------------------- |
| Fingerprinted asset URL                | `public, max-age=31536000, immutable`                    |
| Unfingerprinted checked-in static file | bounded `public, max-age=...` plus validators            |
| Public album HTML                      | short shared cache only if it contains no per-user state |
| Personalized or session-bearing HTML   | `private, no-store`                                      |
| Authorized album cover                 | `private` with a product-specific max age or `no-store`  |

The asset server sets immutable caching for fingerprinted URLs. Configure one fixed release ID across all replicas and change it for every deployment:

```ts filename=app/assets.ts
// Keep these production options in the existing createAssetServer({ ... }) call:
fingerprint: { buildId },
watch: false,
```

Asset compilation is on demand, not a separate build that necessarily materializes every file before startup. Include representative asset requests in deployment smoke checks, and make old release assets available for as long as old HTML can reference them.

For a response owned by an action, set the header where the representation is created. A deliberately public catalog route may opt into a short shared policy such as `public, max-age=60`, but only when every response at that URL is public.

The album page we built is authenticated and contains CSRF-backed controls. Keep the existing render call and add a private policy to that response:

```tsx
return context.render(
  <AlbumPage
    album={{ ...album, artist: album.artist }}
    csrfToken={getCsrfToken(context)}
  />,
  {
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  },
);
```

Do not infer public cacheability from an unauthenticated result. A session-bearing request can still affect flash data, experiments, locale, or CSRF state. Avoid producing both public and personalized bytes at the same cache key.

`Vary` is not a substitute for a clear private policy when the response contains session data. File and static response helpers already support ETags, conditional requests, last-modified dates, and range policy. Do not overwrite those headers casually in outer middleware.

## Compress without breaking streams or ranges {#compression-and-streams}

For production logs, use `%pathname` instead of the default `%path` token so query strings do not enter access logs. Put logging and compression before every middleware response they should observe or transform:

```ts
import { compression } from "remix/middleware/compression";
import { logger } from "remix/middleware/logger";

// Inside createAppRouter(options), keep this cumulative order:
middleware: [
  logger({
    colors: false,
    format: "[%dateISO] %method %pathname %status %duration ms",
  }),
  compression(),
  staticFiles("./public", { index: false }),
  cop(),
  uploadErrors(),
  formData({
    maxHeaderSize: 16 * 1024,
    maxFiles: 1,
    maxFileSize: 2 * 1024 * 1024,
    maxParts: 8,
    maxTotalSize: 2.5 * 1024 * 1024,
  }),
  methodOverride(),
  asyncContext(),
  loadDatabase(options.database),
  loadAlbumCovers(options.albumCovers),
  loadAssetServer(options.assetServer),
  session(options.sessionCookie, options.sessionStorage),
  csrf(),
  loadAuth(),
  loadAssetEntry(),
  render(),
],
```

`compression()` negotiates Brotli, gzip, or deflate for compressible media. It skips a response when there is no useful encoding, the response is already encoded, `Cache-Control` contains `no-transform`, the response advertises `Accept-Ranges: bytes`, or the status is `206 Partial Content`. It also honors the size threshold when `Content-Length` is present.

Streaming HTML can still be compressed. The absence of `Content-Length` does not make a stream ineligible. Server-sent events receive flush-oriented compressor defaults so events are not held indefinitely in a compression buffer.

Test the actual proxy path too, because a CDN or ingress may independently buffer or transform streams.

When compression applies, Remix removes `Content-Length`, adds `Vary: Accept-Encoding`, disables ranges for that representation, and weakens a strong ETag whose bytes changed. Images, archives, and other already-compressed formats generally gain little and are filtered by media type.

## Propagate aborts through streaming work {#streaming-and-aborts}

The Node adapter aborts `request.signal` when the connection closes. Pass that signal through work that can stop:

```tsx
let recommendations = await fetch(recommendationsUrl, {
  signal: request.signal,
});

let stream = renderToStream(page, {
  signal: request.signal,
  onError: reportRenderError,
});
```

An abort prevents the adapter from writing a late response and lets fetches, renderers, and stream readers release work. It does not roll back a committed mutation or cancel a database driver that has no signal API. Keep mutations transactionally correct even if the client disappears.

Report unexpected stream failures, but suppress the exact request abort reason. The adapter and renderer already recognize their cancellation paths; broad application catches should preserve them.

## Report errors without exposing them {#error-handling}

Production has several distinct reporting hooks:

- The Node adapter's `onError` receives an action, middleware, or response-stream failure that reaches the runtime boundary.
- `renderToStream({ onError })` sees server render failures, including later frame failures that may leave a fallback in already-rendered HTML.
- `createAssetServer({ onError })` sees compilation and asset serving failures, and may return a custom response.
- The browser runtime's `error` event sees hydration, component, scheduler, and client frame failures.

Give them one structured reporter and enough boundary metadata to deduplicate repeated observations. The adapter's `onError` receives no `Request`, so install request context and IDs before work that needs them. If the request handler catches a router error and returns its own `500`, the adapter sees a normal response and does not call its error handler.

Public `500` responses should be generic. Logs may include stack traces, release IDs, request IDs, and internal operation names, but should redact cookies, authorization headers, form passwords, provider tokens, and uploaded file contents.

## Add app-owned health checks and observability {#observability-hooks}

Define separate liveness and readiness responses. The album router resolves browser entry URLs in global middleware before controller actions run, so health probes should not be controllers in that router. Answer the two exact operational paths at the adapter boundary instead:

```ts filename=app/health.ts
import { isReady } from "./readiness.ts";

const headers = { "Cache-Control": "no-store" };

export function getHealthResponse(request: Request): Response | undefined {
  if (request.method !== "GET") return;

  let pathname = new URL(request.url).pathname;

  if (pathname === "/health/live") {
    return Response.json({ ok: true }, { headers });
  }

  if (pathname === "/health/ready") {
    let ready = isReady();
    return Response.json(
      { ok: ready },
      {
        status: ready ? 200 : 503,
        headers,
      },
    );
  }
}
```

Wrap the existing router handler with that check:

```ts filename=server.ts
import { getHealthResponse } from "./app/health.ts";

// Replace the existing server creation:
let server = http.createServer(
  createRequestListener(
    (request) => {
      return getHealthResponse(request) ?? router.fetch(request);
    },
    {
      host: config.origin.host,
      onError: handleServerError,
      protocol: config.origin.protocol,
    },
  ),
);
```

Liveness answers whether the process can serve at all. Do not make a temporary database outage restart every healthy process.

Readiness is a lifecycle gate: required initialization completes before it becomes true, and shutdown makes it false before draining connections. If a deployment needs a dependency check before receiving traffic, add a bounded check here without turning liveness into a database restart trigger.

Keep both endpoints cheap, restricted by the deployment network rather than application login, uncached, and free of secret configuration details.

Add request logs with `logger()` or a custom middleware around `router.fetch()`. Log the URL pathname by default; query strings routinely contain search text, reset tokens, and other values that should not enter logs.

Preserve an incoming trace or request ID only from trusted infrastructure. Otherwise generate one, include it in response headers and structured logs, and pass it to downstream calls.

Metrics should cover request count, status, duration, in-flight work, shutdown drain, database pool pressure, asset compilation, and error boundaries in terms the chosen monitoring system understands.

## Deployment checklist {#deployment-checklist}

Before shifting traffic to a release, verify:

- The declared Node/runtime version, typecheck, tests, and doctor checks passed.
- Required configuration and high-entropy secrets fail fast when missing or invalid.
- Migrations ran once through an explicit release/leader mechanism before replicas became ready.
- TLS and proxy trust match the real network path; untrusted clients cannot supply forwarded identity.
- Sessions, uploads, and any required cache state survive the intended replica and restart topology.
- Every replica uses the same deploy-unique asset build ID, and representative asset requests succeed.
- Public, private, immutable, conditional, range, and compression headers match each response type.
- Readiness changes during startup and drain, and the force-close deadline is shorter than the platform grace period.
- Server, renderer, asset, and browser errors reach the reporter without secrets in public responses or logs.
- A smoke request covers HTML, a browser entry, one mutation boundary, a health endpoint, and graceful termination.

Once those behaviors are observable, production is the same request model under explicit operational constraints. [Advanced Guides](/advanced-guides/) now looks at the few places where an application may deliberately extend or replace a Remix layer.
