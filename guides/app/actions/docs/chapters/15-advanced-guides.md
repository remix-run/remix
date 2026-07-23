---
title: Advanced Guides
description: Specialized patterns built from Remix's lower-level UI, proxy, stream, template, storage, and archive APIs.
---

The album application now has routes, actions, UI, data, tests, and production wiring. In this chapter, we'll extend that request path one layer at a time: a host mixin, a rating primitive, a request-scoped renderer, a fixed-target proxy, an event stream, an HTML template, and a tar-backed package browser.

Each extension keeps its policy in focused app modules so it can be tested or replaced without changing the rest of the request path. The proxy, stream, and archive examples also keep their authentication, cancellation, and byte-limit decisions visible in the code.

## Build custom host behavior with createMixin {#building-reusable-mixin-libraries}

Our album pages already use `on`, `ref`, `attrs`, `css`, `link`, and animation mixins. Now suppose several cover layouts need the same `ResizeObserver` behavior. Put it in `app/assets/report-size.tsx` with `createMixin()`:

```tsx filename=app/assets/report-size.tsx
import { createMixin } from "remix/ui";

interface AlbumCoverResizeDetail {
  height: number;
  width: number;
}

declare global {
  interface HTMLElementEventMap {
    "record-store:cover-resize": CustomEvent<AlbumCoverResizeDetail>;
  }
}

export const reportCoverSize = createMixin<HTMLElement, [name: string]>(
  (handle) => {
    let observer: ResizeObserver | undefined;

    handle.addEventListener("insert", (event) => {
      observer = new ResizeObserver(([entry]) => {
        if (!entry) return;

        event.node.dispatchEvent(
          new CustomEvent("record-store:cover-resize", {
            bubbles: true,
            detail: {
              height: entry.contentRect.height,
              width: entry.contentRect.width,
            },
          }),
        );
      });
      observer.observe(event.node);
    });

    handle.addEventListener("remove", () => {
      observer?.disconnect();
      observer = undefined;
    });

    return (name, props: { ["data-size-source"]?: string }) => (
      <handle.element {...props} data-size-source={name} />
    );
  },
);
```

The setup function runs once for a mixin slot. Its returned function receives the captured arguments and current host props on each render. Returning `<handle.element {...props} ... />` transforms host props without replacing its children. `insert` receives the mounted host node; `remove` is the teardown boundary.

Use a namespaced event such as `record-store:cover-resize` so a reusable mixin does not collide with native events or another package. Extending `HTMLElementEventMap` gives `on(...)` a typed detail payload:

```tsx
import { on } from "remix/ui";

<section
  mix={[
    reportCoverSize("album-cover"),
    on("record-store:cover-resize", (event) => {
      console.log(event.detail.width);
    }),
  ]}
/>;
```

For post-render work, `handle.queueTask((node, signal) => ...)` supplies both the bound node and a signal tied to the host runtime lifetime. It remains live across ordinary host re-renders, so do not treat it as per-render cancellation. Use mixin lifecycle cleanup or an app-owned `AbortController` when changing arguments must cancel earlier work.

A pure prop transform can be much smaller:

```tsx
const describedBy = createMixin<HTMLElement, [id: string]>(
  (handle) => (id, props: { ["aria-describedby"]?: string }) => (
    <handle.element {...props} aria-describedby={id} />
  ),
);
```

If a component can express the behavior clearly with existing mixins, stop there. A new mixin becomes a public lifecycle abstraction that needs browser tests for insertion, updates, removal, event typing, and composition order.

## Build a custom UI primitive {#building-custom-ui-primitives}

The record store needs a five-value rating control that none of the first-party components represent. The page that renders it will pass the current `value`, and the control will dispatch a typed bubbling event when the user chooses another value. A hidden input will submit the same value with a native form.

Before writing an app-owned primitive, check the first-party component and its `/primitives` subpath. Use the complete component when its markup fits; use its primitives when the DOM needs to change but its labeling, focus, keyboard, and selection behavior still fit. Here we'll put the rating group and items in one browser-owned module:

```tsx filename=app/assets/rating.tsx
import { on, ref } from "remix/ui";
import type { Handle } from "remix/ui";

export type RatingValue = 1 | 2 | 3 | 4 | 5;

export interface RatingChangeDetail {
  value: RatingValue;
}

export const ratingChangeEvent = "record-store:rating-change" as const;

declare global {
  interface HTMLElementEventMap {
    [ratingChangeEvent]: CustomEvent<RatingChangeDetail>;
  }
}

interface RatingProps {
  disabled?: boolean;
  label: string;
  name?: string;
  resetValue: RatingValue;
  value: RatingValue;
}

interface RatingContext {
  readonly disabled: boolean;
  readonly value: RatingValue;
  request(source: HTMLElement, value: RatingValue): void;
}

export function Rating(handle: Handle<RatingProps, RatingContext>) {
  let rating: RatingContext = {
    get disabled() {
      return handle.props.disabled ?? false;
    },
    get value() {
      return handle.props.value;
    },
    request(source, value) {
      if (rating.disabled || value === rating.value) return;

      let group = source.closest('[role="radiogroup"]');
      group?.dispatchEvent(
        new CustomEvent<RatingChangeDetail>(ratingChangeEvent, {
          bubbles: true,
          detail: { value },
        }),
      );
    },
  };
  handle.context.set(rating);

  return () => (
    <div
      aria-disabled={rating.disabled ? "true" : undefined}
      aria-label={handle.props.label}
      role="radiogroup"
      mix={ref((group, signal) => {
        let form = group.closest("form");
        if (form === null) return;

        form.addEventListener(
          "reset",
          () => rating.request(group, handle.props.resetValue),
          { signal },
        );
      })}
    >
      <RatingItem value={1} />
      <RatingItem value={2} />
      <RatingItem value={3} />
      <RatingItem value={4} />
      <RatingItem value={5} />
      {handle.props.name && !rating.disabled ? (
        <input name={handle.props.name} type="hidden" value={rating.value} />
      ) : null}
    </div>
  );
}

function RatingItem(handle: Handle<{ value: RatingValue }>) {
  let rating = handle.context.get(Rating);

  return () => {
    let { value } = handle.props;
    let selected = rating.value === value;

    return (
      <button
        aria-checked={selected ? "true" : "false"}
        aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
        data-rating-value={value}
        disabled={rating.disabled}
        role="radio"
        tabIndex={selected ? 0 : -1}
        type="button"
        mix={[
          on("click", (event) => {
            rating.request(event.currentTarget, value);
          }),
          on("keydown", (event) => {
            let next = nextRatingValue(value, event.key);
            if (next === null) return;

            event.preventDefault();
            rating.request(event.currentTarget, next);
            event.currentTarget
              .closest('[role="radiogroup"]')
              ?.querySelector<HTMLButtonElement>(
                `[data-rating-value="${next}"]`,
              )
              ?.focus();
          }),
        ]}
      >
        <span aria-hidden="true">★</span>
      </button>
    );
  };
}

function nextRatingValue(value: RatingValue, key: string): RatingValue | null {
  if (key === "Home") return 1;
  if (key === "End") return 5;

  if (key === "ArrowRight" || key === "ArrowDown") {
    return value === 5 ? 1 : ((value + 1) as RatingValue);
  }

  if (key === "ArrowLeft" || key === "ArrowUp") {
    return value === 1 ? 5 : ((value - 1) as RatingValue);
  }

  return null;
}
```

`Rating` provides one live context object. Each `RatingItem` reads the current controlled value through its getters, so an owner update changes checked state and tab order without replacing the context.

The arrow keys wrap, while Home and End move to the first and last values. Native button activation already covers Enter, Space, pointer, and assistive technology clicks. A disabled rating disables every button and omits the hidden field, keeping the value out of focus order and form submission.

The reset listener does not mutate controlled state. It dispatches the same change request with `resetValue`, leaving the owner responsible for the update. The listener is attached only after insertion and is removed with the element's signal.

Add browser tests for the three behaviors the owner relies on: clicking changes both ARIA and form state, arrow keys move focus, and a disabled rating neither changes nor submits a value:

```tsx filename=app/assets/rating.test.browser.tsx
import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { on } from "remix/ui";
import type { Handle } from "remix/ui";
import { render } from "remix/ui/test";

import { Rating, ratingChangeEvent, type RatingValue } from "./rating.tsx";

function ControlledRating(handle: Handle<{ disabled?: boolean }>) {
  let value: RatingValue = 2;

  return () => (
    <form>
      <div
        mix={on(ratingChangeEvent, (event) => {
          value = event.detail.value;
          handle.update();
        })}
      >
        <Rating
          disabled={handle.props.disabled}
          label="Album rating"
          name="rating"
          resetValue={2}
          value={value}
        />
      </div>
    </form>
  );
}

describe("Rating", () => {
  it("updates its checked value and native form value", async (t) => {
    let { $, act, cleanup } = render(<ControlledRating />);
    t.after(cleanup);

    let four = $('[aria-label="4 stars"]');
    assert.ok(four instanceof HTMLButtonElement);
    await act(() => four.click());

    assert.equal(four.getAttribute("aria-checked"), "true");
    let input = $('input[name="rating"]');
    assert.ok(input instanceof HTMLInputElement);
    assert.equal(input.value, "4");
  });

  it("moves with arrow keys and resets through the owner", async (t) => {
    let { $, act, cleanup } = render(<ControlledRating />);
    t.after(cleanup);

    let two = $('[aria-label="2 stars"]');
    assert.ok(two instanceof HTMLButtonElement);
    await act(() => {
      two.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "ArrowRight",
        }),
      );
    });

    let three = $('[aria-label="3 stars"]');
    assert.ok(three instanceof HTMLButtonElement);
    assert.equal(three.getAttribute("aria-checked"), "true");
    assert.equal(document.activeElement, three);

    let form = $("form");
    assert.ok(form instanceof HTMLFormElement);
    await act(() => form.reset());
    assert.equal(two.getAttribute("aria-checked"), "true");
  });

  it("does not change or submit a value when disabled", async (t) => {
    let { $, act, cleanup } = render(<ControlledRating disabled />);
    t.after(cleanup);

    let five = $('[aria-label="5 stars"]');
    assert.ok(five instanceof HTMLButtonElement);
    await act(() => five.click());

    assert.equal(five.getAttribute("aria-checked"), "false");
    assert.equal($("input[name=rating]"), null);
  });
});
```

Keep styling separate from this state and event contract. The component can add `css(...)` later without changing its semantics, form value, or application event.

## Render custom value types through middleware {#custom-renderers}

Earlier chapters installed the Remix UI renderer at `context.render`. If the same router also serves a small JSON document, give that renderer a discriminated input instead of stacking another `renderWith()` middleware. Every `renderWith()` writes the same `context.render` key, so later middleware would replace the earlier renderer:

```ts filename=app/middleware/render-document.ts
import type { SafeHtml } from "remix/html-template";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";

type AppDocument =
  | { kind: "html"; body: SafeHtml }
  | { kind: "json"; value: unknown };

export function renderDocument() {
  return renderWith(
    () =>
      function render(document: AppDocument, init?: ResponseInit) {
        if (document.kind === "json") {
          return Response.json(document.value, init);
        }

        return createHtmlResponse(document.body, init);
      },
  );
}
```

An action now chooses the response by passing either an HTML or JSON document:

```ts
return context.render(
  { kind: "json", value: { albums } },
  {
    headers: { "Cache-Control": "public, max-age=30" },
  },
);
```

Use separate routers or call a focused helper directly when the representations do not need one shared abstraction. For Remix UI, keep `request.signal`, frame resolution, client-entry asset URLs, response status, and headers inside the renderer because they are request-specific. For email, rendering may produce a value for a mail provider rather than an HTTP response; do not force unrelated outputs through `context.render` merely for symmetry.

## Proxy HTTP requests with Fetch {#fetch-proxying}

`createFetchProxy()` forwards Fetch requests to one configured target. Start by adding a nested route map so the root controller does not own this low-level endpoint:

```ts filename=app/routes.ts
// Add this branch inside route({ ... }).
vendorCatalog: {
  proxy: "/vendor-catalog/*path",
},
```

Resolve and validate the target when its module loads:

```ts filename=app/vendor-catalog.ts
import { createFetchProxy } from "remix/fetch-proxy";

let catalogOriginValue = process.env.CATALOG_ORIGIN;
if (!catalogOriginValue) {
  throw new Error("CATALOG_ORIGIN is required");
}

let catalogOrigin = new URL(catalogOriginValue);
if (
  catalogOrigin.origin !== "https://catalog.internal.example" ||
  catalogOrigin.username ||
  catalogOrigin.password ||
  catalogOrigin.pathname !== "/" ||
  catalogOrigin.search ||
  catalogOrigin.hash
) {
  throw new Error("CATALOG_ORIGIN must be the approved HTTPS catalog origin");
}

export const catalogProxy = createFetchProxy(catalogOrigin, {
  rewriteCookieDomain: false,
  rewriteCookiePath: false,
  xForwardedHeaders: false,
});
```

Now add the controller that puts the proxy policy in code. It requires a signed-in user, accepts six HTTP methods, strips credentials and forwarding headers, limits client bodies to 256 KiB and catalog bodies to 2 MiB, rejects redirects, and aborts the upstream request after five seconds:

```ts filename=app/actions/vendor-catalog/controller.ts
import { requireAuth } from "remix/middleware/auth";
import { createController } from "remix/router";

import { routes } from "../../routes.ts";
import { catalogProxy } from "../../vendor-catalog.ts";

const maxRequestBytes = 256 * 1024;
const maxResponseBytes = 2 * 1024 * 1024;

class ProxyBodyLimitError extends Error {
  side: "request" | "response";

  constructor(side: "request" | "response") {
    super(`Proxy ${side} exceeds its byte limit`);
    this.side = side;
  }
}

function parseContentLength(value: string | null): number | null | undefined {
  if (value === null) return null;
  if (!/^(0|[1-9]\d*)$/.test(value)) return undefined;

  let length = Number(value);
  return Number.isSafeInteger(length) ? length : undefined;
}

async function cancelBody(body: ReadableStream | null): Promise<void> {
  if (body !== null) await body.cancel().catch(() => undefined);
}

function proxyError(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function stripHopByHopHeaders(headers: Headers): void {
  let connection = headers.get("Connection");
  for (let name of connection?.split(",") ?? []) {
    name = name.trim();
    if (/^[\w!#$%&'*+.^`|~-]+$/.test(name)) headers.delete(name);
  }

  for (let name of [
    "Connection",
    "Keep-Alive",
    "Proxy-Connection",
    "TE",
    "Trailer",
    "Transfer-Encoding",
    "Upgrade",
  ]) {
    headers.delete(name);
  }
}

async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  side: "request" | "response",
): Promise<ArrayBuffer | null> {
  if (body === null) return null;

  let reader = body.getReader();
  let chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      let result = await reader.read();
      if (result.done) break;

      total += result.value.byteLength;
      if (total > maxBytes) throw new ProxyBodyLimitError(side);
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  let bytes = new Uint8Array(total);
  let offset = 0;
  for (let chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

function upstreamHeaders(request: Request): Headers {
  let headers = new Headers(request.headers);
  stripHopByHopHeaders(headers);
  for (let name of [
    "Authorization",
    "Cookie",
    "Forwarded",
    "Host",
    "If-Match",
    "If-Modified-Since",
    "If-None-Match",
    "If-Range",
    "If-Unmodified-Since",
    "Origin",
    "Proxy-Authorization",
    "Range",
    "X-Csrf-Token",
    "X-Real-Ip",
  ]) {
    headers.delete(name);
  }
  for (let name of [...headers.keys()]) {
    if (name.startsWith("x-forwarded-")) headers.delete(name);
  }
  return headers;
}

export default createController(routes.vendorCatalog, {
  middleware: [requireAuth()],
  actions: {
    async proxy(context) {
      if (
        !["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"].includes(
          context.request.method,
        )
      ) {
        return new Response("Method not allowed", {
          status: 405,
          headers: {
            Allow: "DELETE, GET, HEAD, PATCH, POST, PUT",
            "Cache-Control": "no-store",
          },
        });
      }

      let requestLength = parseContentLength(
        context.request.headers.get("Content-Length"),
      );
      if (requestLength === undefined) {
        return proxyError("Invalid request content length", 400);
      }
      if (requestLength !== null && requestLength > maxRequestBytes) {
        return proxyError("Request body too large", 413);
      }

      let requestBody: ArrayBuffer | null;
      try {
        requestBody = await readBoundedBody(
          context.request.body,
          maxRequestBytes,
          "request",
        );
      } catch (error) {
        if (context.request.signal.aborted) throw context.request.signal.reason;
        if (error instanceof ProxyBodyLimitError) {
          return proxyError("Request body too large", 413);
        }
        return proxyError("Invalid request body", 400);
      }

      let headers = upstreamHeaders(context.request);
      headers.delete("Content-Length");
      if (requestBody !== null) {
        headers.set("Content-Length", String(requestBody.byteLength));
      }

      let timeout = AbortSignal.timeout(5_000);
      let signal = AbortSignal.any([context.request.signal, timeout]);

      try {
        let request = new Request(context.request.url, {
          method: context.request.method,
          headers,
          body: requestBody,
          signal,
        });
        let response = await catalogProxy(request, {
          redirect: "manual",
          signal,
        });

        if (response.status >= 300 && response.status < 400) {
          await cancelBody(response.body);
          return proxyError("Upstream redirects are not allowed", 502);
        }

        let responseLength = parseContentLength(
          response.headers.get("Content-Length"),
        );
        if (
          responseLength === undefined ||
          (responseLength !== null && responseLength > maxResponseBytes)
        ) {
          await cancelBody(response.body);
          return proxyError("Catalog response is too large", 502);
        }

        let body = await readBoundedBody(
          response.body,
          maxResponseBytes,
          "response",
        );
        let responseHeaders = new Headers(response.headers);
        stripHopByHopHeaders(responseHeaders);
        responseHeaders.delete("Content-Encoding");
        responseHeaders.delete("Content-Length");
        responseHeaders.delete("Proxy-Authenticate");
        responseHeaders.delete("Set-Cookie");
        responseHeaders.delete("WWW-Authenticate");
        for (let name of [...responseHeaders.keys()]) {
          if (name.startsWith("access-control-")) responseHeaders.delete(name);
        }
        responseHeaders.set("Cache-Control", "no-store");
        responseHeaders.set(
          "Content-Security-Policy",
          "sandbox; default-src 'none'",
        );
        responseHeaders.set("X-Content-Type-Options", "nosniff");
        if (body !== null) {
          responseHeaders.set("Content-Length", String(body.byteLength));
        }

        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch (error) {
        if (context.request.signal.aborted) throw context.request.signal.reason;
        if (error instanceof ProxyBodyLimitError) {
          return proxyError("Catalog response is too large", 502);
        }
        if (timeout.aborted) {
          return proxyError("Catalog request timed out", 504);
        }
        return proxyError("Catalog request failed", 502);
      }
    },
  },
});
```

Import the controller at module scope in `app/router.ts`. Map it inside the factory after the existing controllers and before `return router`:

```ts filename=app/router.ts
import vendorCatalogController from "./actions/vendor-catalog/controller.ts";

export function createAppRouter(options: AppRouterOptions) {
  let router = createRouter({
    // Keep the middleware and options from Chapter 12.
  });

  // Keep the existing controller mappings, then add:
  router.map(routes.vendorCatalog, vendorCatalogController);

  return router;
}
```

`createFetchProxy()` appends the incoming pathname and search to the fixed target. This example therefore assumes the internal service exposes the same `/vendor-catalog/` prefix. If it uses another prefix, change the fixed target and public route together. Never derive the target from the request host, a query parameter, or unvalidated data.

Four details make the controller's boundary explicit:

- `requireAuth()` admits any signed-in record-store user. Replace it with app authorization middleware when catalog access is role-specific. The cumulative `cop()` and `csrf()` middleware from Chapter 12 still reject unsafe browser mutations before this controller runs. The same stack's `formData()` and `methodOverride()` middleware consume form-encoded and multipart bodies before any action, so a proxied form-typed mutation would arrive here with its body already read and possibly a rewritten method. Proxy JSON as this section does, or mount the proxy route on a router branch that skips those two middleware.
- `xForwardedHeaders: false` prevents the helper from adding forwarding identity, and the controller removes inbound forwarding headers. Add server-owned values only when the upstream explicitly trusts this app.
- Buffering both directions lets the controller reject an oversized body before sending a partial response.
- Fetch may decompress the upstream body. The proxy removes stale encoding and length metadata, the controller writes the final `Content-Length`, and it strips hop-by-hop headers, upstream CORS policy, cookies, and authentication challenges before responding.

## Stream server-sent events {#server-sent-events}

Server-sent events are a good fit for one-way updates such as album-import progress. Add a typed GET leaf to the app's route tree:

```ts filename=app/routes.ts
// inside route({ ... })
imports: {
  progress: get("/imports/progress"),
},
```

Map that leaf through a controller and return a byte stream with the event-stream media type:

```ts filename=app/actions/imports/controller.ts
import { createController } from "remix/router";

import { routes } from "../../routes.ts";

function encodeEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

export default createController(routes.imports, {
  actions: {
    progress(context) {
      let interval: ReturnType<typeof setInterval> | undefined;
      let closed = false;

      let stream = new ReadableStream<Uint8Array>({
        start(controller) {
          let percent = 0;

          function stop() {
            if (interval) clearInterval(interval);
            interval = undefined;
          }

          function close() {
            if (closed) return;
            closed = true;
            stop();
            controller.close();
          }

          interval = setInterval(() => {
            percent = Math.min(percent + 10, 100);
            controller.enqueue(encodeEvent("progress", { percent }));

            if (percent === 100) {
              controller.enqueue(encodeEvent("complete", { percent }));
              close();
            }
          }, 1000);

          context.request.signal.addEventListener("abort", close, {
            once: true,
          });
        },
        cancel() {
          if (interval) clearInterval(interval);
          interval = undefined;
          closed = true;
        },
      });

      return new Response(stream, {
        headers: {
          "Cache-Control": "no-cache, no-transform",
          "Content-Type": "text/event-stream; charset=utf-8",
        },
      });
    },
  },
});
```

Import the controller at module scope in `app/router.ts`, then register it inside `createAppRouter(options)` before the factory returns:

```ts filename=app/router.ts
import importsController from "./actions/imports/controller.ts";

export function createAppRouter(options: AppRouterOptions) {
  let router = createRouter({
    // Keep the middleware and options from Chapter 12.
  });

  // Keep the existing controller mappings, then add:
  router.map(routes.imports, importsController);

  return router;
}
```

The stream writes one JSON value on each `data:` line and ends each event with a blank line. It stops at 100% and also closes when the request is aborted. If a reverse proxy has an idle timeout, add heartbeats at a shorter interval. Keep `no-transform`; if you enable SSE compression yourself, test proxy buffering before relying on incremental delivery.

Create `app/assets/import-progress.tsx`. It owns one `EventSource` and closes it when the component is removed:

```tsx filename=app/assets/import-progress.tsx
import { addEventListeners, clientEntry } from "remix/ui";
import type { Handle } from "remix/ui";

declare global {
  interface EventSourceEventMap {
    complete: MessageEvent<string>;
    progress: MessageEvent<string>;
  }
}

type ImportStatus = "connecting" | "connected" | "complete" | "disconnected";

function parsePercent(data: string): number | undefined {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return undefined;
  }

  if (typeof value !== "object" || value === null || !("percent" in value)) {
    return undefined;
  }

  let percent = value.percent;
  return typeof percent === "number" && percent >= 0 && percent <= 100
    ? percent
    : undefined;
}

export const ImportProgress = clientEntry(
  import.meta.url,
  function ImportProgress(handle: Handle<{ progressHref: string }>) {
    let status: ImportStatus = "connecting";
    let percent = 0;

    handle.queueTask(() => {
      let source = new EventSource(handle.props.progressHref);

      addEventListeners(source, handle.signal, {
        open() {
          status = "connected";
          handle.update();
        },
        progress(event) {
          let nextPercent = parsePercent(event.data);
          if (nextPercent === undefined) return;

          percent = nextPercent;
          if (percent === 100) {
            status = "complete";
            source.close();
          }
          handle.update();
        },
        complete() {
          status = "complete";
          percent = 100;
          source.close();
          handle.update();
        },
        error() {
          if (status === "complete") return;
          status = "disconnected";
          source.close();
          handle.update();
        },
      });

      handle.signal.addEventListener("abort", () => source.close(), {
        once: true,
      });
    });

    return () => (
      <p aria-live="polite">
        {status === "complete"
          ? "Import complete"
          : status === "connected"
            ? `Import ${percent}% complete`
            : status === "connecting"
              ? "Connecting to import…"
              : "Import stream disconnected"}
      </p>
    );
  },
);
```

Pass the typed progress URL from the page that starts the import:

```tsx filename=app/actions/imports/page.tsx
import { ImportProgress } from "../../assets/import-progress.tsx";
import { routes } from "../../routes.ts";

// inside the page render:
<ImportProgress progressHref={routes.imports.progress.href()} />;
```

`parsePercent()` rejects malformed event data before it reaches component state. Native `EventSource` normally reconnects after an error; this component closes it instead, so disconnected imports stay disconnected.

## Generate safe HTML without Remix UI {#safe-html-templates}

Small documents that do not need components or hydration can use `remix/html-template`. Interpolations are escaped by default and `SafeHtml` fragments compose without double escaping:

```ts filename=app/actions/albums/feed.ts
import { html } from "remix/html-template";
import { createHtmlResponse } from "remix/response/html";

import { routes } from "../../routes.ts";
import type { AlbumWithArtist } from "../../data/schema.ts";

export function albumList(albums: ReadonlyArray<AlbumWithArtist>) {
  let rows = albums.map((album) => {
    if (album.artist === null) {
      throw new Error(`Album ${album.id} is missing its artist`);
    }

    return html`
      <li>
        <a href="${routes.albums.show.href({ albumId: album.id })}">
          ${album.title} — ${album.artist.name}
        </a>
      </li>
    `;
  });

  return createHtmlResponse(html`
    <html lang="en">
      <head>
        <title>Album catalog</title>
      </head>
      <body>
        <main>
          <h1>Albums</h1>
          <ul>
            ${rows}
          </ul>
        </main>
      </body>
    </html>
  `);
}
```

An album title containing `<script>` becomes text. Attribute interpolation must still be quoted as shown. Escaping protects the current HTML context; it does not validate URL schemes or make values safe inside executable `<script>` or `<style>` content. Keep executable content out of templates and validate the scheme of any externally supplied URL. `createHtmlResponse()` adds the HTML content type and a doctype when needed.

`html.raw` is an explicit trust assertion, not the way to render normal dynamic content. Reserve it for a fragment defined and audited as trusted source, and never wrap an upstream response, Markdown result, package file, or user field merely to make markup appear. Prefer composing `SafeHtml` fragments, as the package-browser demo does; it does not need `html.raw` for directory and file names.

## Parse tar archives and build package browsers {#tar-parsing-and-package-browser-style-apps}

`parseTar()` reads POSIX, GNU, and PAX tar entries from Web streams. We can use it to add a small browser for one pinned Remix package. Pinning the tarball keeps package and version parsing out of this example and gives every successful response an immutable URL.

Add a catch-all route for paths inside the package:

```ts filename=app/routes.ts
// Add this branch inside route({ ... }).
packages: {
  show: get("/packages/*path"),
},
```

The route accepts arbitrary path text, so the package reader must treat that text as hostile. It also has to distrust paths and sizes inside the tarball. Put those checks next to the archive parser:

```ts filename=app/packages/read-package.ts
import { detectMimeType } from "remix/mime";
import { parseTar } from "remix/tar-parser";

const registryOrigin = "https://registry.npmjs.org";
const tarballUrl = new URL("/remix/-/remix-3.0.0-beta.5.tgz", registryOrigin);

const maxCompressedBytes = 20 * 1024 * 1024;
const maxExpandedBytes = 100 * 1024 * 1024;
const maxEntries = 10_000;
const maxBufferedFileBytes = 2 * 1024 * 1024;

export interface PackageItem {
  kind: "directory" | "file";
  name: string;
  path: string;
  size: number;
}

export type PackageResult =
  | { kind: "directory"; items: PackageItem[] }
  | { kind: "file"; file: File };

export class PackageArchiveError extends Error {}

export function parsePackagePath(value: string): string | null {
  if (value === "") return "";
  if (
    value.startsWith("/") ||
    /^[A-Za-z]:/.test(value) ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    return null;
  }

  let segments = value.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    return null;
  }

  return value;
}

function limitBytes(maxBytes: number): TransformStream<Uint8Array, Uint8Array> {
  let seen = 0;

  return new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > maxBytes) {
        throw new PackageArchiveError("Package archive exceeds its byte limit");
      }
      controller.enqueue(chunk);
    },
  });
}

function gunzip(): TransformStream<Uint8Array, Uint8Array> {
  // lib.dom types this writable side as BufferSource, which includes Uint8Array.
  return new DecompressionStream("gzip") as TransformStream<
    Uint8Array,
    Uint8Array
  >;
}

function archivePath(name: string, type: string): string {
  if (!name.startsWith("package/")) {
    throw new PackageArchiveError(
      "Package archive contains an unexpected root",
    );
  }

  let path = name.slice("package/".length);
  if (type === "directory" && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  if (parsePackagePath(path) === null) {
    throw new PackageArchiveError("Package archive contains an unsafe path");
  }

  return path;
}

export async function readPackage(
  requestedPath: string,
  requestSignal: AbortSignal,
): Promise<PackageResult | null> {
  try {
    return await readPackageArchive(requestedPath, requestSignal);
  } catch (error) {
    if (requestSignal.aborted) {
      throw requestSignal.reason;
    }
    if (error instanceof PackageArchiveError) {
      throw error;
    }

    throw new PackageArchiveError("Package archive could not be read", {
      cause: error,
    });
  }
}

async function readPackageArchive(
  requestedPath: string,
  requestSignal: AbortSignal,
): Promise<PackageResult | null> {
  if (
    tarballUrl.origin !== registryOrigin ||
    tarballUrl.username ||
    tarballUrl.password
  ) {
    throw new PackageArchiveError("Package registry origin is not allowed");
  }

  let signal = AbortSignal.any([requestSignal, AbortSignal.timeout(10_000)]);
  let response = await fetch(tarballUrl, { redirect: "error", signal });
  if (!response.ok || response.body === null) {
    throw new PackageArchiveError(
      `Package fetch failed with ${response.status}`,
    );
  }

  let contentLengthHeader = response.headers.get("Content-Length");
  if (contentLengthHeader !== null) {
    let contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new PackageArchiveError(
        "Package archive has an invalid content length",
      );
    }
    if (contentLength > maxCompressedBytes) {
      throw new PackageArchiveError("Package archive exceeds its byte limit");
    }
  }

  let archive = response.body
    .pipeThrough(limitBytes(maxCompressedBytes))
    .pipeThrough(gunzip())
    .pipeThrough(limitBytes(maxExpandedBytes));

  let prefix = requestedPath === "" ? "" : `${requestedPath}/`;
  let items = new Map<string, PackageItem>();
  let exactFileStarted = false;
  let exactFile: Promise<File> | undefined;
  let exactDirectory = requestedPath === "";
  let totalEntries = 0;

  await parseTar(archive, (entry) => {
    totalEntries++;
    if (totalEntries > maxEntries) {
      throw new PackageArchiveError("Package archive has too many entries");
    }

    if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
      throw new PackageArchiveError("Package archive contains an invalid size");
    }

    let type = entry.header.type;
    let path = archivePath(entry.name, type);
    if (type !== "file" && type !== "directory") return;
    if (path === requestedPath) {
      if (type === "directory") {
        exactDirectory = true;
        return;
      }
      if (exactFileStarted) {
        throw new PackageArchiveError(
          "Package archive contains a duplicate file",
        );
      }
      if (entry.size > maxBufferedFileBytes) {
        throw new PackageArchiveError("Package file exceeds its buffer limit");
      }

      exactFileStarted = true;
      exactFile = entry.bytes().then(
        (bytes) =>
          new File([bytes.slice()], path.split("/").at(-1)!, {
            lastModified: 0,
            type: detectMimeType(path) ?? "application/octet-stream",
          }),
      );
      return exactFile.then(() => undefined);
    }

    if (!path.startsWith(prefix)) return;
    let relativePath = path.slice(prefix.length);
    if (relativePath === "") return;

    let slash = relativePath.indexOf("/");
    let name = slash === -1 ? relativePath : relativePath.slice(0, slash);
    let childPath = prefix + name;
    let kind: PackageItem["kind"] =
      slash === -1 && type === "file" ? "file" : "directory";
    let previous = items.get(childPath);

    if (previous && previous.kind !== kind) {
      throw new PackageArchiveError(
        "Package archive contains conflicting entries",
      );
    }
    if (!previous) {
      items.set(childPath, {
        kind,
        name,
        path: childPath,
        size: kind === "file" ? entry.size : 0,
      });
    }
  });

  if (exactFile) {
    if (exactDirectory || items.size > 0) {
      throw new PackageArchiveError(
        "Package path is both a file and a directory",
      );
    }
    return { kind: "file", file: await exactFile };
  }

  if (!exactDirectory && items.size === 0) return null;
  return {
    kind: "directory",
    items: [...items.values()].sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    }),
  };
}
```

Only the selected file calls `entry.bytes()`, and only after its declared size passes the two-megabyte limit. Directory requests retain bounded metadata for direct children, not every file body.

The callback is deliberately not `async`. Header and entry-limit failures therefore throw while `parseTar()` is scanning and stop it immediately. The selected file returns its body promise so `parseTar()` still waits for those bytes before resolving.

The compressed and expanded stream limits defend against oversized responses and decompression bombs. The entry limit bounds metadata and parser work. Symlinks, devices, and other entry types are ignored. Fetch, timeout, decompression, and tar-format failures become `PackageArchiveError`; an aborted client request remains an abort instead of being rewritten as an upstream error.

Now render directories as escaped HTML and return file bytes through `createFileResponse()`:

```tsx filename=app/actions/packages/controller.tsx
import { html } from "remix/html-template";
import { detectMimeType } from "remix/mime";
import { createFileResponse } from "remix/response/file";
import { createHtmlResponse } from "remix/response/html";
import { createController } from "remix/router";

import {
  PackageArchiveError,
  parsePackagePath,
  readPackage,
} from "../../packages/read-package.ts";
import { routes } from "../../routes.ts";

const immutable = "public, max-age=31536000, immutable";

export default createController(routes.packages, {
  actions: {
    async show(context) {
      let path = parsePackagePath(context.params.path);
      if (path === null) {
        return new Response("Invalid package path", {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        });
      }

      let result;
      try {
        result = await readPackage(path, context.request.signal);
      } catch (error) {
        if (!(error instanceof PackageArchiveError)) throw error;
        return new Response("Package archive is unavailable", {
          status: 502,
          headers: { "Cache-Control": "no-store" },
        });
      }

      if (result === null) {
        return new Response("Package path not found", {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        });
      }

      if (result.kind === "file") {
        let response = await createFileResponse(result.file, context.request, {
          acceptRanges: true,
          cacheControl: immutable,
          etag: "strong",
          lastModified: false,
        });
        response.headers.set(
          "Cache-Control",
          response.ok || response.status === 304 ? immutable : "no-store",
        );
        response.headers.set(
          "Content-Security-Policy",
          "sandbox; default-src 'none'",
        );
        response.headers.set("X-Content-Type-Options", "nosniff");
        return response;
      }

      let parentPath = path.split("/").slice(0, -1).join("/");
      let parent = path
        ? html`<li>
            <a href="${routes.packages.show.href({ path: parentPath })}">
              ../
            </a>
          </li>`
        : null;
      let rows = result.items.map((item) => {
        let type =
          item.kind === "directory"
            ? "directory"
            : (detectMimeType(item.path) ?? "file");
        let suffix = item.kind === "directory" ? "/" : "";

        return html`<li>
          <a href="${routes.packages.show.href({ path: item.path })}">
            ${item.name}${suffix}
          </a>
          <small>${type} · ${item.size} bytes</small>
        </li>`;
      });

      return createHtmlResponse(
        html`
          <html lang="en">
            <head>
              <title>remix@3.0.0-beta.5/${path}</title>
            </head>
            <body>
              <main>
                <h1>remix@3.0.0-beta.5/${path}</h1>
                <ul>
                  ${parent} ${rows}
                </ul>
              </main>
            </body>
          </html>
        `,
        { headers: { "Cache-Control": immutable } },
      );
    },
  },
});
```

Import the package controller at module scope in `app/router.ts`. Map it with the other route owners inside `createAppRouter(options)` before `return router`:

```ts filename=app/router.ts
import packagesController from "./actions/packages/controller.tsx";

export function createAppRouter(options: AppRouterOptions) {
  let router = createRouter({
    // Keep the middleware and options from Chapter 12.
  });

  // Keep the existing controller mappings, then add:
  router.map(routes.packages, packagesController);

  return router;
}
```

Open `/packages/`. `html` escapes every displayed name and attribute value. `routes.packages.show.href(...)` encodes each already-validated path for a URL.

File contents never enter the directory document. `createFileResponse()` handles content type, conditionals, and ranges for the file itself. The sandbox policy prevents an HTML or SVG file in the package from running with the record store's origin, and `nosniff` keeps unknown bytes from being promoted to an executable type.

The tarball URL is assembled from a literal path and an exact registry origin. Redirects are rejected, and the combined abort signal supplies a ten-second deadline. Because the package version is pinned, successful directory and file responses can be cached as immutable. Validation errors, range failures, and upstream failures use `no-store` so an error is not retained.

For a browser that accepts arbitrary package names and versions, validate both syntaxes before building registry URLs. Resolve metadata only from the fixed registry, re-check the metadata tarball origin, and cache a bounded index instead of fetching and parsing on every request.

This example does not write archive entries to `FileStorage`. Adding it would not make large files stream automatically: memory storage and the current S3 backend materialize values. For larger packages, use a storage-specific object stream, precompute the directory index, or return object and range responses directly.

## Check the built-in layer before replacing it {#integrating-external-services}

Use the first column as the default. Move to the third only when the named constraint applies:

| Requirement     | Start with                                                          | Extend only when                                                            |
| --------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Identity        | built-in session/bearer/API-key scheme or OAuth/OIDC provider       | the credential source or protocol is genuinely different                    |
| Forms/uploads   | `formData()` with limits and an upload handler                      | the body is non-form multipart or needs custom part semantics               |
| Data            | data-table queries and transactions                                 | a database feature needs parameterized raw SQL the query API cannot express |
| MIME            | `remix/mime` detection                                              | the app owns a missing media registration and its handling policy           |
| UI behavior     | complete component, then available primitives, then built-in mixins | markup or lifecycle requirements cannot be composed safely                  |
| HTTP forwarding | fixed-target `createFetchProxy()`                                   | upstream protocol behavior needs a reviewed custom Fetch handler            |

Whichever row you extend, put the adapter in one module and test it there. Keep the result shape, server-side token storage, SQL parameters, multipart limits, or cancellation behavior that the surrounding Remix layer expects. Record why the built-in path did not fit so a later first-party feature can replace the adapter cleanly.
