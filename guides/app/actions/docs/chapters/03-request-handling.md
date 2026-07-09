---
title: Request Handling
description: How a Web Request becomes a Web Response across runtime adapters and the middleware pipeline.
---

[Routing and Controllers](/docs/routing-and-controllers) covered what happens after Remix finds a route. This chapter backs up to the server boundary: how a runtime hands the app a Web [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request), how middleware prepares request context, and how the resulting Web [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) gets back to the client.

The runtime-specific code stays in the server entry. The router, middleware, and actions work with the same Fetch API contract everywhere else.

## The Web Request/Response contract {#the-web-request-response-contract}

A Remix router is a fetch handler. Its `fetch()` method accepts a URL or Web `Request` and resolves to a Web `Response`:

```ts
let request = new Request("https://albums.example/albums/thriller", {
  method: "GET",
  headers: { Accept: "text/html" },
});

let response = await router.fetch(request);

console.log(response.status); // 200
console.log(response.headers.get("Content-Type"));
```

That call is the same whether it comes from a Node server, a Bun server, a Cloudflare Worker, or a test. The runtime adapter does not define routes or know how pages render. It only bridges its native server API to `Request` and `Response` when a bridge is needed.

For each call to `router.fetch(...)`, Remix:

1. Creates request context from the incoming `Request`.
2. Runs router middleware.
3. Matches `context.method` and `context.url` against the registered routes.
4. Runs controller and action middleware for the matched route.
5. Calls the action and receives its `Response`.
6. Unwinds the middleware chain, then resolves `router.fetch(...)` with the final response.

If no route matches, the router returns a `404` response. If middleware or an action throws, `router.fetch(...)` rejects. The server entry is the last place to catch that error and turn it into a `500` response.

Request and response bodies stay as Web streams. An action can read `request.body`, return a `Response` backed by a `ReadableStream`, and respond to cancellation through `request.signal` without dropping down to a runtime-specific request object.

## The Node server entry {#the-node-server-entry}

The default Remix app runs on `node:http`. Its `server.ts` creates the Node server and connects it to the app router:

```ts filename=server.ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { router } from "./app/router.ts";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100;

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request);
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error);
      }

      return new Response("Internal Server Error", { status: 500 });
    }
  }),
);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
```

`server.ts` owns Node concerns such as the port, TLS, shutdown signals, and any integration that needs Node's raw request or response objects. `app/router.ts` owns application concerns such as middleware, routes, and controllers.

Keep that boundary narrow. Code that only needs a URL, headers, cookies, a body, or an abort signal can use Web APIs on the other side of `createRequestListener`.

## createRequestListener {#createrequestlistener}

`createRequestListener(...)` adapts a Fetch handler to the callback expected by `http.createServer(...)`. For each Node request, it:

- constructs the full request URL from the protocol, host, and incoming path;
- exposes the incoming headers and body through a Web `Request`;
- aborts `request.signal` if the client disconnects;
- passes the request to your Fetch handler; and
- writes the returned response status, headers, and streamed body through Node.

The same listener works with `node:http`, `node:https`, and Node's HTTP/2 compatibility API. Most apps only need to pass `router.fetch(...)` through a small error boundary, as shown above.

The listener accepts a few options when the server boundary needs more information:

| Option       | Use                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `host`       | Set a fixed host when constructing `request.url`.                                                                     |
| `protocol`   | Set a fixed protocol such as `"https:"`.                                                                              |
| `trustProxy` | Read trusted `Forwarded` and `X-Forwarded-*` headers for the URL and client address.                                  |
| `onError`    | Log an uncaught error and optionally return the `Response` that should be sent instead of the default `500` response. |

For example, a Node server behind a trusted reverse proxy can let the listener recover the public protocol and host:

```ts filename=server.ts
const requestListener = createRequestListener(
  (request) => router.fetch(request),
  {
    trustProxy: true,
    onError(error) {
      console.error(error);
      return new Response("Internal Server Error", { status: 500 });
    },
  },
);

const server = http.createServer(requestListener);
```

Only enable `trustProxy` when clients cannot reach the app server without going through a proxy that overwrites those headers. Otherwise, a client can spoof the protocol, host, or address your app sees.

A handler may also accept a second argument with the client address, address family, and port:

```ts
const requestListener = createRequestListener((request, client) => {
  console.log(`Request from ${client.address}:${client.port}`);
  return router.fetch(request);
});
```

If an existing Node integration needs lower-level control, `remix/node-fetch-server` also exports `createRequest(...)` and `sendResponse(...)`. Prefer `createRequestListener(...)` until you need to work between those two operations.

## Alternate runtimes: Bun, Deno, Workers {#alternate-runtimes-bun-deno-workers}

Bun, Deno, and edge worker runtimes already accept Fetch handlers, so they do not need the Node adapter. Their entrypoints can call the same router directly.

Bun uses the handler in `Bun.serve(...)`:

```ts filename=server.ts
import { router } from "./app/router.ts";

Bun.serve({
  port: 44100,
  fetch(request) {
    return router.fetch(request);
  },
});
```

Deno uses the handler in `Deno.serve(...)`:

```ts filename=server.ts
import { router } from "./app/router.ts";

Deno.serve({ port: 44100 }, (request) => {
  return router.fetch(request);
});
```

A Cloudflare Worker exports an object with a `fetch` method:

```ts filename=worker.ts
import { router } from "./app/router.ts";

export default {
  fetch(request) {
    return router.fetch(request);
  },
} satisfies ExportedHandler;
```

These abbreviated entries omit the error logging from the Node example. Add a `try`/`catch` around `router.fetch(...)` when the runtime's default error response and logging are not what the app needs.

The router contract is portable, but every package in a middleware stack may not be. For example, the current static-file and compression middleware use Node filesystem and compression APIs. On a worker, serve static assets through the platform and use the platform's response compression instead.

## Middleware ordering {#middleware-ordering}

Middleware wraps the rest of the request pipeline. Given two middleware functions, the request runs from left to right and the response unwinds from right to left:

```txt
request  → first → second → action
response ← first ← second ← action
```

That order comes from `next()`:

```ts
import type { Middleware } from "remix/router";

function timing(): Middleware {
  return async (context, next) => {
    let start = performance.now();
    let response = await next();
    let duration = performance.now() - start;

    console.log(
      `${context.method} ${context.url.pathname} ${duration.toFixed(1)}ms`,
    );
    return response;
  };
}
```

Code before `await next()` runs on the way in. Code after it runs on the way out and can inspect or replace the downstream response. Returning a `Response` without calling `next()` stops the chain, which is how static files, CORS preflights, authorization checks, and caches can answer a request early.

Remix has three middleware scopes:

1. **Router middleware** runs before route matching for every request passed to the router.
2. **Controller middleware** runs for the direct actions owned by that controller.
3. **Action middleware** runs for one action.

The complete order is router middleware, controller middleware, action middleware, then the action handler. Controller and action middleware only run after a route matches. As covered in [Routing and Controllers](/docs/routing-and-controllers), controller middleware does not flow into controllers mapped for nested route maps.

Choose middleware order by dependency and wrapping behavior:

- Put a provider before its consumer, such as `formData()` before `methodOverride()`.
- Put a response wrapper before an early response it should transform, such as `compression()` before `staticFiles()`.
- Put work that a fast path does not need after that fast path, such as rendering setup after static files.

The same rules apply to sessions, CSRF, and authentication: load a session before middleware reads it, parse form data before checking a form token, and resolve authentication before requiring an authenticated user.

## Typed request context {#typed-request-context}

Every middleware and action in one `router.fetch(...)` call receives the same request context object. It starts with the original `request`, parsed `url`, a mutable `Headers` copy, the effective `method`, matched `params`, and the current `router`. Middleware can add request-scoped values with `context.set(key, value)`, and downstream code reads them with `context.get(key)`.

Built-in middleware carries its context changes in its TypeScript type. For example, `formData()` provides `context.formData`, while `renderWith(...)` provides the app's typed `context.render(...)` function.

For a single-router app, derive the application context from the configured router and use module augmentation to make that context the default for controllers:

```ts filename=app/router.ts
import { formData } from "remix/middleware/form-data";
import { staticFiles } from "remix/middleware/static";
import { createRouter, type RouterContext } from "remix/router";

import controller from "./actions/controller.tsx";
import albumsController from "./actions/albums/controller.tsx";
import albumsEditController from "./actions/albums/edit/controller.tsx";
import { render } from "./middleware/render.tsx";
import { routes } from "./routes.ts";

export const router = createRouter({
  middleware: [staticFiles("./public", { index: false }), formData(), render()],
});

export type AppContext = RouterContext<typeof router>;

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext;
  }
}

router.map(routes, controller);
router.map(routes.albums, albumsController);
router.map(routes.albums.edit, albumsEditController);
```

`RouterContext<typeof router>` follows the inline middleware tuple in order. In the edit controller, TypeScript now knows that both values are present:

```tsx filename=app/actions/albums/edit/controller.tsx
import { createController } from "remix/router";

import { routes } from "../../../routes.ts";

export default createController(routes.albums.edit, {
  actions: {
    action(context) {
      let title = context.formData.get("title");

      return context.render(<p>Submitted {String(title)}</p>);
    },
  },
});
```

The module augmentation is useful because controllers are created in separate files before they are mapped to this router. Apps with multiple routers should pass explicit context types instead of setting one application-wide default.

When a reusable middleware chain must be stored in a variable, `createMiddleware(...)` preserves its tuple type and `MiddlewareContext<typeof middleware>` derives the resulting context. Inline middleware arrays and `RouterContext<typeof router>` are the simpler default.

Request context is still an explicit per-request value, not a global. If a helper outside middleware or an action must reach it, add `asyncContext()` from `remix/middleware/async-context` and call `getContext()` inside that helper. That middleware uses Node's async context support, so passing the needed value as a function argument remains the portable option.

## Common middleware: form-data, render, static files, compression, logging, method override {#common-middleware}

The default app starts with static-file and render middleware. Add the others when the request path needs them:

| Middleware         | Import                                        | What it does                                                                                                                | Placement                                                                                       |
| ------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `formData()`       | `remix/middleware/form-data`                  | Parses URL-encoded and multipart bodies once, then provides `context.formData`. Non-form requests receive empty `FormData`. | Before `methodOverride()`, CSRF form-field checks, or actions that read parsed form data.       |
| app `render()`     | `renderWith()` from `remix/middleware/render` | Installs the app's request-scoped `context.render(...)` function.                                                           | After middleware that may answer without rendering.                                             |
| `staticFiles()`    | `remix/middleware/static`                     | Serves `GET` and `HEAD` requests from a directory, with conditional and range request support.                              | Early, before request enrichment that static files do not need.                                 |
| `compression()`    | `remix/middleware/compression`                | Negotiates Brotli, gzip, or deflate for suitable downstream responses.                                                      | Before every response it should wrap, including `staticFiles()` when static text is compressed. |
| `logger()`         | `remix/middleware/logger`                     | Logs the request and downstream response and provides `context.logger(...)`.                                                | Usually first so early responses and `404`s are logged.                                         |
| `methodOverride()` | `remix/middleware/method-override`            | Replaces `context.method` from a form field, `_method` by default.                                                          | After `formData()` and before route matching.                                                   |

A server-rendered app that accepts HTML forms might use all six:

```ts filename=app/router.ts
import { compression } from "remix/middleware/compression";
import { formData } from "remix/middleware/form-data";
import { logger } from "remix/middleware/logger";
import { methodOverride } from "remix/middleware/method-override";
import { staticFiles } from "remix/middleware/static";
import { createRouter } from "remix/router";

import { render } from "./middleware/render.tsx";

export const router = createRouter({
  middleware: [
    logger(),
    compression(),
    staticFiles("./public", { index: false }),
    formData(),
    methodOverride(),
    render(),
  ],
});
```

Global middleware is convenient when most routes use it. If only one action accepts a form or upload, put `formData()` on that action instead so other requests skip body parsing.

Method override is an exception because it must change `context.method` before route matching. When forms use `_method` to reach `PUT`, `PATCH`, or `DELETE` routes, put both `formData()` and `methodOverride()` in the router middleware stack.

`staticFiles()` serves files exactly as they exist under `public/`. Browser modules compiled from `.browser.ts` and `.browser.tsx` source use `remix/assets` instead; [Files and Assets](/docs/files-and-assets) covers that pipeline. The next chapter, [Rendering UI](/docs/rendering-ui), builds the app's `render()` middleware with `renderWith(...)` and `renderToStream(...)`.

## Custom middleware {#custom-middleware}

A custom middleware is a function that receives `(context, next)` and returns a `Response` or the response from `next()`. Use a context key when it provides a request-scoped value.

This middleware assigns a request ID before the action runs, then adds the same ID to the response on the way out:

```ts filename=app/middleware/request-id.ts
import { createContextKey, type Middleware } from "remix/router";

export const RequestId = createContextKey<string>();

export function requestId(): Middleware<{
  key: typeof RequestId;
  value: string;
}> {
  return async (context, next) => {
    let id = crypto.randomUUID();
    context.set(RequestId, id);

    let response = await next();
    let headers = new Headers(response.headers);
    headers.set("X-Request-Id", id);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
```

The `Middleware<{ key, value }>` type records what the middleware adds. Once `requestId()` is part of the typed router stack, downstream controllers read `context.get(RequestId)` as a `string` rather than `string | undefined`.

A middleware that rejects a request returns its response without calling `next()`:

```ts
function requireJson(): Middleware {
  return (context, next) => {
    let mediaType = context.headers
      .get("Content-Type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();

    if (mediaType !== "application/json") {
      return new Response("Expected JSON", { status: 415 });
    }

    return next();
  };
}
```

Keep custom middleware focused on one request-lifecycle concern. Route-specific data loading or validation usually belongs in the action, while behavior shared across many routes—request IDs, sessions, authentication, security headers, and database access—fits the middleware pipeline.
