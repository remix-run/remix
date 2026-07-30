---
title: Production
description: How to configure, start, cache, observe, and shut down a Remix application in production.
---

A production Remix app is still a Fetch handler behind a runtime adapter. Deployment work configures that adapter, initializes durable services, assigns cache policy, and closes resources without inventing a separate application architecture.

## Run the generated Node server {#production-server}

The starter runs TypeScript source with `node --import remix/node-tsx server.ts` and adapts `router.fetch()` through `remix/node-fetch-server`. Explain when a deployment should keep that server and when its runtime requires a different Fetch adapter.

## Validate environment variables and secrets at startup {#environment-variables-and-secrets}

Read configuration once, validate required ports, origins, database URLs, session secrets, and provider credentials, and fail before listening when a required value is missing. Never fall back to demo secrets outside tests.

## Configure hosts, TLS, and trusted proxies {#trusted-proxies}

Set fixed host or protocol options when the deployment owns them. Enable `trustProxy` only when the app is reachable exclusively through a proxy that overwrites forwarded headers; otherwise clients can spoof public URLs and addresses.

## Initialize before listening, then shut down once {#startup-and-shutdown}

Connect shared stores, run migrations, and construct long-lived routers or asset servers before accepting traffic. On `SIGINT` and `SIGTERM`, stop new connections, close active Node connections according to the deployment's grace period, then close asset watchers, database clients, caches, and other owned resources exactly once.

## Choose process-safe storage {#process-safe-storage}

Memory sessions, process-local caches, and local upload directories do not automatically work across replicas. Use shared Redis, Memcache, database, S3-compatible, or deployment-persistent storage where state must survive restarts or move between app processes.

## Assign cache policy by response type {#caching}

Use fingerprinted immutable caching for production assets, validators and bounded max ages for static or file responses, and private or no-store policy for personalized HTML. Set `Vary`, ETag, range, and conditional-request behavior deliberately with standard headers or `remix/headers`.

## Compress without breaking streams or ranges {#compression-and-streams}

Use `compression()` for compressible responses and let it skip existing encodings, byte ranges, partial responses, and `no-transform`. Preserve flush behavior for server-sent events and avoid compressing content that gains little from it.

## Propagate aborts through streaming work {#streaming-and-aborts}

Pass `request.signal` to `renderToStream()` and downstream fetches so disconnects cancel unresolved work. Treat abort reasons as expected cancellation, while still reporting genuine stream, renderer, and storage failures.

## Report errors without exposing them {#error-handling}

Use the server adapter's error handler, renderer `onError`, asset-server `onError`, and browser runtime `error` event as distinct reporting points. Return generic public `500` responses and send request IDs or structured details to the app's logging service.

## Add app-owned health checks and observability {#observability-hooks}

Remix supplies request logging and explicit error hooks, not a deployment-specific metrics backend. Add health routes, trace propagation, metrics, and structured logs around the Fetch and middleware boundaries required by the chosen platform.

## Deployment checklist {#deployment-checklist}

Verify runtime versions, environment validation, migrations, trusted-proxy settings, session and upload storage, asset build IDs, cache headers, graceful shutdown, error reporting, health checks, and a smoke request against the deployed origin.
