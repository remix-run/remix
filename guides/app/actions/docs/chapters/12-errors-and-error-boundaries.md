---
title: Errors and Cancellation
description: How expected HTTP failures, uncaught server errors, rendering failures, client runtime errors, and aborted work propagate through Remix.
---

Remix does not turn every failure into a component error boundary. Expected outcomes are responses; unexpected exceptions cross the router boundary; rendering and browser runtime errors use explicit reporting hooks.

## Return expected failures as responses {#returning-error-responses-in-controllers}

Validation errors, conflicts, authentication failures, forbidden operations, and missing records are part of the route contract. Return the intended status, headers, and HTML or JSON body directly instead of throwing an error only to translate it elsewhere.

## Render useful not-found responses {#not-found-and-404-responses}

Return a route-specific `404` page when the action understands what is missing. Let an unmatched URL use the router's not-found response, and keep internal record identifiers or exception details out of public error bodies.

## Handle uncaught action and middleware errors at the server boundary {#uncaught-server-errors}

`router.fetch()` rejects when an action or middleware throws. Catch it around the runtime adapter, or pass an `onError` option to `createRequestListener(handler, options)`, so the exception is reported and a generic `500` response is returned before response bytes start.

## Report streaming render failures {#streaming-render-errors}

Pass `onError` and `request.signal` to `renderToStream()`. Root and blocking-render failures report the error and reject the stream. A later non-blocking frame or streamed frame-tail failure is reported while the already-rendered fallback remains. After body bytes are sent, the server cannot replace the response with a new error page.

## Own frame-resolution failures {#frame-resolution-errors}

The app's `resolveFrame` function decides how a non-success frame response appears. It may return bounded fallback HTML, preserve an authentication redirect policy, or reject and let the render/runtime error handler take over.

## Handle browser runtime errors at the app root {#error-boundaries}

The value returned by `run()` emits `error` events for hydration, component, scheduler, and frame failures. Listen once in the browser entry, report the original `event.error`, dispose broken runtime state when needed, and render or navigate to an app-owned fallback.

## Treat request aborts as cancellation {#aborts-request-signal-and-the-router}

The router rejects with `request.signal.reason` when a request aborts. Pass the signal into database, fetch, upload, and rendering work when those APIs support it, and let the Node adapter drop responses after the client disconnects instead of logging an expected abort as a server failure.

## Match component cleanup to the work's lifetime {#cancellation-in-components-with-handle-signal}

Use event-handler signals for re-entrant event work, queued-task signals for work invalidated by the next render, `ref` signals for element-owned resources, and `handle.signal` for component-lifetime listeners or streams. Check the relevant signal before applying asynchronous results.
