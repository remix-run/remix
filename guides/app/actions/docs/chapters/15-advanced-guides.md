---
title: Advanced Guides
description: Specialized patterns built from Remix's lower-level UI, proxy, stream, template, storage, and archive APIs.
---

The main album application is complete. The patterns in this chapter start from a narrower question: which Remix layer should change when the normal component, middleware, provider, or response helper cannot represent a real requirement?

Each extension should stay small enough to replace. A custom mixin does not require a new component model, a proxy does not make arbitrary destinations safe, and a streaming parser does not remove the need for byte limits.

## Build custom host behavior with createMixin {#building-reusable-mixin-libraries}

The built-in `on`, `ref`, `attrs`, `css`, `link`, and animation mixins cover most element behavior. Use `createMixin()` when several components need the same host-element lifecycle or semantic event.

Suppose album layouts need to react when a cover container changes size. One mixin can own the `ResizeObserver`, expose a data attribute during server rendering, and dispatch a typed bubbling event in the browser:

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

## Decide when to build a custom UI primitive {#building-custom-ui-primitives}

Before building an interactive primitive, check the first-party packages. Popover, listbox, and anchor are already low-level building blocks. Accordion, combobox, menu, select, tabs, and toggle expose `/primitives` subpaths for designs that need different composition than their complete components. Not every UI package has a `/primitives` export.

Start with the complete component when its markup fits. Move to its primitives when the visual DOM must change but the same labeling, focus, keyboard, and selection contract still applies. Build an app-owned primitive only when neither level can represent the interaction.

For example, a record store might need a five-value rating control. Its contract should be visible before its styles:

- A labeled group contains five buttons with current checked state.
- Arrow keys and activation follow one documented keyboard model.
- A controlled `value` comes from the owner; a bubbling `change` event asks the owner to update it.
- A `name` produces a hidden input so native forms submit the same value.
- App CSS is separate from the state and event contract.

That design needs more than five clickable stars. It needs focus movement, disabled behavior, form reset behavior, server markup that matches hydration, and browser tests. Context is useful when nested `RatingItem` components need the group value and setters without prop threading; a bubbling custom event is useful at the application boundary.

Keep those responsibilities in one package or module instead of spreading keyboard logic across page components. Use the component's setup scope for state, `handle.context.set(...)` for descendant contracts, and host mixins for DOM listeners. Do not read browser globals from ordinary server-rendered setup code.

## Render custom value types through middleware {#custom-renderers}

`renderWith()` installs a request-scoped renderer at `context.render`. The UI renderer in earlier chapters accepted `RemixNode`; an email preview or small feed may need another value type.

One middleware installs one renderer key. Stacking several `renderWith()` middlewares does not create `context.renderHtml`, `context.renderJson`, and `context.renderFeed`; later middleware overwrites the same context entry. Use one discriminated input when routes in the same router genuinely share several representations:

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

Now actions still return explicit responses through one request-scoped API:

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

`createFetchProxy()` forwards Fetch requests to one configured target. Resolve and validate that target during startup:

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

Map a bounded app route to it:

```ts filename=app/router.ts
router.route("ANY", "/vendor-catalog/*path", async (context) => {
  await requireCatalogAccess(context);

  let headers = new Headers(context.request.headers);
  headers.delete("Authorization");
  headers.delete("Cookie");
  headers.delete("Forwarded");
  for (let name of [...headers.keys()]) {
    if (name.startsWith("x-forwarded-")) headers.delete(name);
  }

  let response = await catalogProxy(context.request, {
    headers,
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    return new Response("Upstream redirects are not allowed", { status: 502 });
  }

  let responseHeaders = new Headers(response.headers);
  responseHeaders.delete("Set-Cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
});
```

The proxy appends the incoming pathname and search to the configured target. Choose the public route and target base path so that result is intentional.

The helper does not decide whether the destination is safe. Never construct its target from a query parameter, request host, or unvalidated database value; that creates an SSRF/open-proxy boundary. A fixed initial target is only complete when redirect policy is fixed too. Apply authentication, body limits, timeouts, and response-size policy outside the proxy for the operation being exposed.

With `xForwardedHeaders: true`, the helper appends `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-Port`; it does not add `X-Forwarded-For`. The bounded example disables this behavior and removes inbound forwarding identity. Only add server-owned forwarding headers when the upstream trusts this app, and do not append them to an attacker-supplied chain.

Fetch may transparently decompress an upstream response. The proxy removes stale transfer/content encoding and length headers when they no longer describe the returned body. Apply final-client compression after proxying. Cookie rewriting changes cookie scope; disabling rewriting does not suppress upstream cookies. The handler deletes every `Set-Cookie` header so a host-only upstream cookie cannot become a cookie for the public app origin.

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

Register the controller at its owner route:

```ts filename=app/router.ts
import importsController from "./actions/imports/controller.ts";

router.map(routes.imports, importsController);
```

Each `data:` line contains one JSON value and each event ends with a blank line. Real streams should send bounded heartbeats when infrastructure has idle timeouts and close when the underlying job ends. Compliant intermediaries should honor `no-transform`, and Remix compression skips this response. If an app removes that directive and chooses SSE compression, Remix supplies flush-oriented defaults, but the proxy path still needs buffering tests.

Own `EventSource` in a client entry and close it with the component lifetime. The server-rendered page passes `routes.imports.progress.href()` as `progressHref`, keeping the browser asset inside the generated `app/assets/**` allow boundary:

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

Validate parsed event data before treating it as application state. Native `EventSource` reconnects by default; closing it in `error` opts out, so choose retry behavior intentionally.

## Generate safe HTML without Remix UI {#safe-html-templates}

Small documents that do not need components or hydration can use `remix/html-template`. Interpolations are escaped by default and `SafeHtml` fragments compose without double escaping:

```ts filename=app/actions/albums/feed.ts
import { html } from "remix/html-template";
import { createHtmlResponse } from "remix/response/html";

import { routes } from "../../routes.ts";
import type { Album } from "./data.ts";

export function albumList(albums: ReadonlyArray<Album>) {
  let rows = albums.map(
    (album) => html`
      <li>
        <a href="${routes.albums.show.href({ albumId: album.id })}">
          ${album.title} — ${album.artist}
        </a>
      </li>
    `,
  );

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

`parseTar()` reads POSIX, GNU, and PAX tar entries from Web streams. A package browser can fetch a fixed registry tarball, decompress it, and build a bounded manifest without holding the compressed archive in one buffer:

```ts filename=app/packages/read-manifest.ts
import { parseTar } from "remix/tar-parser";

function limitBytes(maxBytes: number) {
  let seen = 0;

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > maxBytes) throw new Error("Archive exceeds byte limit");
      controller.enqueue(chunk);
    },
  });
}

export async function readPackageManifest(
  tarballUrl: URL,
  signal: AbortSignal,
) {
  if (
    tarballUrl.origin !== "https://registry.npmjs.org" ||
    tarballUrl.username ||
    tarballUrl.password
  ) {
    throw new Error("Unexpected package registry origin");
  }

  let response = await fetch(tarballUrl, { redirect: "error", signal });
  if (!response.ok || response.body === null) {
    throw new Error(`Package fetch failed: ${response.status}`);
  }

  let archive = response.body
    .pipeThrough(limitBytes(20 * 1024 * 1024))
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(limitBytes(100 * 1024 * 1024));

  let files: Array<{ name: string; size: number }> = [];
  let totalEntries = 0;

  await parseTar(archive, (entry) => {
    totalEntries++;
    if (totalEntries > 10_000) throw new Error("Archive has too many entries");
    if (entry.header.type !== "file") return;

    files.push({ name: entry.name, size: entry.size });
  });

  return files;
}
```

The compressed and expanded byte limits defend against large responses and decompression bombs; the entry limit bounds metadata growth. Validate names before mapping archive paths to URLs or disk paths. Ignore symlinks, devices, and other entry types unless the product has an explicit safe policy for them.

Reading an entry with `entry.bytes()` buffers that entry. Building an in-memory map of every file buffers the extracted package even though `parseTar()` itself is incremental. The UNPKG-style demo in this repository currently buffers the fetched archive, decompressed tarball, and file contents; treat it as a bounded demo, not evidence of zero-buffer caching.

`FileStorage` accepts File-compatible values, but buffering depends on the backend. Filesystem storage can use `LazyFile`; memory storage and the current S3 backend materialize values, and S3 buffers both puts and gets. Large package browsers need a storage-specific streaming object path, a precomputed index, or direct range/object responses rather than a claim that `FileStorage` makes every stage streaming.

Catch-all routes, MIME detection, and safe HTML rendering complete the browser, but keep remote fetch origins fixed, redirect counts and timeouts bounded, package/version syntax validated, and binary bytes out of inline HTML unless their format and content policy allow it.

## Extend low-level protocol support deliberately {#integrating-external-services}

Use this escalation order when an integration stops fitting:

| Requirement     | Start with                                                          | Extend only when                                                            |
| --------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Identity        | built-in session/bearer/API-key scheme or OAuth/OIDC provider       | the credential source or protocol is genuinely different                    |
| Forms/uploads   | `formData()` with limits and an upload handler                      | the body is non-form multipart or needs custom part semantics               |
| Data            | data-table queries and transactions                                 | a database feature needs parameterized raw SQL the query API cannot express |
| MIME            | `remix/mime` detection                                              | the app owns a missing media registration and its handling policy           |
| UI behavior     | complete component, then available primitives, then built-in mixins | markup or lifecycle requirements cannot be composed safely                  |
| HTTP forwarding | fixed-target `createFetchProxy()`                                   | upstream protocol behavior needs a reviewed custom Fetch handler            |

A custom auth scheme still returns the same auth result shape. A custom provider still stores tokens server-side. Raw SQL still uses parameters and the same transaction boundary. A multipart escape hatch still enforces header, part, file, and total limits. An extension should preserve the security and cancellation contracts of the layer it replaces.

Document why the higher-level API did not fit, test the boundary independently, and keep the adapter in one module. That makes a future first-party feature or service change a local replacement instead of another framework hidden inside the application.
