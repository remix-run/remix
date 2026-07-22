---
title: Rendering UI
description: How Remix components produce HTML, stream frames, collect CSS, and compose first-party UI.
---

In [Request Handling](/request-handling/), we followed a request through middleware and into a controller action. This chapter picks up at `context.render(...)`: we will build the component tree that action passes in, connect it to the server renderer, and add the document, styles, and UI controls around it.

Remix UI is a small component runtime built for server rendering and browser enhancement. It uses JSX, but it is not React. Components have an explicit setup phase, updates happen when you ask for them, and the server can stream independently rendered regions with `<Frame>`.

## The Remix component model {#the-remix-component-model}

A Remix component receives a `handle` and returns a render function. The component itself is the setup phase. It runs once for each component instance, so variables declared there live as long as that instance. The returned function is the render phase. It runs for the first render and again after an update.

Here is a small album card:

```tsx filename=app/actions/albums/album-card.tsx
import type { Handle } from "remix/ui";

import type { Album } from "./data.ts";

export function AlbumCard(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props;

    return (
      <article>
        <p>{album.artist}</p>
        <h2>{album.title}</h2>
        <p>{album.year}</p>
      </article>
    );
  };
}
```

`Handle<Props>` describes the JSX props accepted by the component. Read their current values from `handle.props` inside the render function. The render function may return elements, strings, numbers, arrays, `null`, or any other `RemixNode` value.

Components compose through ordinary JSX:

```tsx filename=app/actions/albums/show-page.tsx
import type { Handle } from "remix/ui";

import { Document } from "../../ui/document.tsx";
import { AlbumCard } from "./album-card.tsx";
import type { Album } from "./data.ts";

export function AlbumPage(handle: Handle<{ album: Album }>) {
  return () => (
    <Document title={`${handle.props.album.title} — Albums`}>
      <main>
        <AlbumCard album={handle.props.album} />
      </main>
    </Document>
  );
}
```

The next example renders two instances of the same counter. Each instance runs setup once and keeps its own `count` variable.

::frame{src="/examples/04-rendering-ui/component-model/"}

## Props, local state, context, and updates {#handle-props-setup-render-and-updates}

`handle.props` keeps the same object identity for the component lifetime, but Remix refreshes its properties before each render. Read a prop in the callback or render that needs it. Destructuring a prop during setup captures only its initial value.

Local state is ordinary JavaScript in setup scope:

```tsx filename=app/assets/quantity.tsx
import { clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

export const Quantity = clientEntry(
  import.meta.url,
  function Quantity(handle: Handle<{ initialValue?: number }>) {
    let value = handle.props.initialValue ?? 1;

    return () => (
      <button
        mix={on("click", () => {
          value++;
          handle.update();
        })}
        type="button"
      >
        Quantity: {value}
      </button>
    );
  },
);
```

Changing `value` does not schedule work by itself. `handle.update()` asks Remix to run this component's render function again. It returns a promise, so an event handler can await the updated DOM before focusing or measuring an element.

Keep values that affect output in setup scope, then derive the rest during render. A filtered list, for example, needs to store the search text but can calculate the matching rows each time it renders.

`handle` also carries a few component-scoped tools:

- `handle.id` is stable for one component instance. Use it to connect a label and control without allocating an app-wide ID.
- `handle.context.set(value)` provides a value to descendants, and `handle.context.get(Provider)` reads the nearest value from that provider.
- `handle.queueTask(task)` schedules work after a render. The task receives an abort signal that expires on the next render or removal.
- `handle.signal` aborts when the component disconnects. It is the cleanup boundary for component-lifetime work.

Context is useful when descendants need a value but intermediate components do not:

```tsx filename=app/ui/section.tsx
import type { Handle, RemixNode } from "remix/ui";

export function Section(
  handle: Handle<
    { children?: RemixNode; tone: "default" | "muted" },
    { tone: string }
  >,
) {
  let section = { tone: handle.props.tone };
  handle.context.set(section);

  return () => {
    section.tone = handle.props.tone;
    return <section data-tone={section.tone}>{handle.props.children}</section>;
  };
}

export function SectionNote(handle: Handle) {
  let section = handle.context.get(Section);

  return () => <p data-tone={section.tone}>This note follows its section.</p>;
}
```

The provider keeps one context object so descendants that captured it during setup see the current `tone`. Calling `handle.context.set(...)` does not schedule a render. If an event changes the provided value, update the context and call `handle.update()`.

Event listeners, DOM references, and browser-only cleanup enter the picture after hydration. [Interactivity](/interactivity/) covers those parts of the handle lifecycle.

## Rendering pages through request context {#rendering-pages-through-request-context}

Components describe output, but controller actions still return Web `Response` objects. The bridge between those two APIs belongs in render middleware.

Create `app/middleware/render.tsx` and install a renderer with `renderWith(...)`:

```tsx filename=app/middleware/render.tsx
import * as path from "node:path";

import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import type { Router } from "remix/router";
import type { RemixNode } from "remix/ui";
import { renderToStream, type ResolveFrameContext } from "remix/ui/server";

import { assetServer } from "../assets.ts";

export function render() {
  return renderWith((context) => {
    let request = context.request;
    let router = context.router;

    return function render(node: RemixNode, init?: ResponseInit) {
      let stream = renderToStream(node, {
        frameSrc: request.url,
        signal: request.signal,
        resolveFrame: (src, target, frameContext) =>
          resolveFrame(router, request, src, target, frameContext),
        async resolveClientEntry(entryId, component) {
          if (!entryId.startsWith("file://")) {
            throw new Error(
              `Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`,
            );
          }

          return {
            href: await assetServer.getHref(entryId),
            exportName:
              entryId.split("#")[1] ||
              component.name ||
              titleCaseFileName(entryId),
          };
        },
        onError(error) {
          console.error(error);
        },
      });

      return createHtmlResponse(stream, init);
    };
  });
}

async function resolveFrame(
  router: Router,
  request: Request,
  src: string,
  target?: string,
  context?: ResolveFrameContext,
) {
  let frameSrc = context?.currentFrameSrc ?? request.url;
  let url = new URL(src, frameSrc);
  let requestOrigin = new URL(request.url).origin;

  assertSameOrigin(url, requestOrigin);

  let headers = new Headers({
    Accept: "text/html",
    "Accept-Encoding": "identity",
    "X-Remix-Frame": "true",
  });

  if (target) headers.set("X-Remix-Target", target);

  let cookie = request.headers.get("Cookie");
  if (cookie) headers.set("Cookie", cookie);

  let response = await followFrameRedirects(
    router,
    request,
    url,
    requestOrigin,
    headers,
  );
  if (!response.ok) {
    return `<pre>Frame error: ${response.status}</pre>`;
  }

  return response.body ?? response.text();
}

async function followFrameRedirects(
  router: Router,
  request: Request,
  url: URL,
  requestOrigin: string,
  headers: Headers,
) {
  let currentUrl = url;
  let redirectsRemaining = 10;

  while (true) {
    let response = await router.fetch(
      new Request(currentUrl, {
        method: "GET",
        headers,
        signal: request.signal,
      }),
    );

    let location = response.headers.get("Location");
    if (!location || response.status < 300 || response.status >= 400) {
      return response;
    }

    if (redirectsRemaining-- <= 0) {
      throw new Error("Too many frame redirects");
    }

    currentUrl = new URL(location, currentUrl);
    assertSameOrigin(currentUrl, requestOrigin);
  }
}

function assertSameOrigin(url: URL, requestOrigin: string) {
  if (url.origin !== requestOrigin) {
    throw new Error("Refusing to render a cross-origin frame");
  }
}

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

This renderer owns the request-specific work that route actions should not repeat:

- `request.signal` cancels unresolved rendering work when the request ends.
- `resolveFrame(...)` turns a same-origin frame URL into HTML by sending an internal request through the same router. Redirects stay on that origin, so the incoming `Cookie` header is never forwarded to another host.
- Successful frame bodies stay as streams instead of being buffered into a string.
- `resolveClientEntry(...)` maps a source module ID to the browser asset URL used during hydration.
- `createHtmlResponse(...)` adds the HTML content type and document doctype.

Add `render()` to the router middleware stack. Deriving `AppContext` from that stack gives controllers a typed `context.render(...)` method, as shown in [Request Handling](/request-handling/#typed-request-context).

An action can now turn a component tree into a response:

```tsx filename=app/actions/albums/controller.tsx
// inside the show action:
let album = await getAlbum(context.params.albumId);

if (album === undefined) {
  return new Response("Album not found", { status: 404 });
}

return context.render(<AlbumPage album={album} />);
```

`context.render(...)` accepts a `ResponseInit` when the page needs a status or headers. A validation action can render the same form with a `400` status instead of losing the submitted values in a plain text response.

## Server rendering with renderToStream and renderToString {#server-rendering-with-rendertostream-and-rendertostring}

`remix/ui/server` provides two renderers:

| API                | Result                          | Use it when                                             |
| ------------------ | ------------------------------- | ------------------------------------------------------- |
| `renderToStream()` | `ReadableStream<Uint8Array>`    | Returning an HTTP response or streaming deferred frames |
| `renderToString()` | A promise for one HTML `string` | The caller needs the complete HTML before continuing    |

The app renderer above uses `renderToStream()` so the runtime can send the document while non-blocking frames are still resolving. Always pass `request.signal` when rendering an HTTP request, and use `onError` to report failures that are not cancellations.

`renderToString()` is useful for static generation, an email body, or a snapshot that must be held as one value:

```tsx
import { renderToString } from "remix/ui/server";

let html = await renderToString(<AlbumPage album={album} />);
```

Both APIs render the same component model. Choosing between them changes how the output is delivered, not how a component is written.

## Blocking and streaming frames {#streaming-and-deferred-rendering}

`<Frame>` gives one region of a page its own server-rendered source. The main page can ask a separate route for album recommendations:

First add the route leaf to the existing album route map:

```ts filename=app/routes.ts
// inside routes.albums:
recommendations: get("/albums/:albumId/recommendations"),
```

Then implement that direct leaf in the album controller. This small action returns an HTML fragment rather than another complete document because its response will render inside the album page:

```tsx filename=app/actions/albums/controller.tsx
// inside the actions object:
async recommendations(context) {
  let album = await getAlbum(context.params.albumId);

  if (album === undefined) {
    return new Response("Album not found", { status: 404 });
  }

  return context.render(
    <aside aria-labelledby="recommendations-heading">
      <h2 id="recommendations-heading">More like {album.title}</h2>
      <p>Recommendations are still being selected.</p>
    </aside>,
  );
},
```

Now point the frame at that route:

```tsx filename=app/actions/albums/show-page.tsx
import { Frame } from "remix/ui";

import { routes } from "../../routes.ts";

// inside AlbumPage's render function:
<Frame
  name="recommendations"
  src={routes.albums.recommendations.href({ albumId: handle.props.album.id })}
  fallback={<p>Loading recommendations…</p>}
/>;
```

The route at `src` returns normal HTML. During server rendering, the app's `resolveFrame(...)` function fetches it through the router.

A frame has two server modes:

- Without `fallback`, rendering blocks until the frame resolves. Its HTML is part of the initial response chunk.
- With `fallback`, the fallback is sent in the initial document. The resolved HTML streams later and replaces it.

Use a blocking frame when the page is incomplete without that region. Use a fallback when the outer page is already useful and the frame may take longer. Nested frames follow the same rule.

Frames are not limited to initial rendering. After the browser runtime starts, a client entry can reload its containing frame or a named frame without rebuilding that region from JSON. We will do that in [Interactivity](/interactivity/#frames-and-partial-server-rendered-ui).

## Document shells, head content, and HTML responses {#document-shells-and-head-content}

A page component should render the complete document explicitly. Remix does not move a `<title>` or `<meta>` rendered elsewhere into `<head>`.

Resolve the document's asset URLs in middleware so development paths, production fingerprints, and preload discovery use the same asset server policy:

```ts filename=app/middleware/asset-entry.ts
import { getContext } from "remix/middleware/async-context";
import { createContextKey, type Middleware } from "remix/router";

import { assetServer } from "../assets.ts";

interface AssetEntry {
  scriptPreloads: string[];
  scriptSrc: string;
  stylesheetHref: string;
}

const AssetEntry = createContextKey<AssetEntry>();

export function loadAssetEntry(): Middleware<{
  key: typeof AssetEntry;
  value: AssetEntry;
}> {
  return async (context, next) => {
    let [scriptSrc, scriptPreloads, stylesheetHref] = await Promise.all([
      assetServer.getHref("app/assets/entry.ts"),
      assetServer.getPreloads("app/assets/entry.ts").catch(() => []),
      assetServer.getHref("app/assets/base.css"),
    ]);

    context.set(AssetEntry, { scriptPreloads, scriptSrc, stylesheetHref });
    return next();
  };
}

export function getAssetEntry(): AssetEntry {
  return getContext().get(AssetEntry);
}
```

`getContext()` needs async-context middleware. Put it before the asset loader and renderer:

```ts filename=app/router.ts
// add alongside the existing imports:
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { staticFiles } from "remix/middleware/static";
import { createRouter } from "remix/router";

import { loadAssetEntry } from "./middleware/asset-entry.ts";
import { render } from "./middleware/render.tsx";

// replace only the existing createRouter(...) call; keep the AppContext
// declaration and controller mappings that follow it:
export const router = createRouter({
  middleware: [
    staticFiles("./public", { index: false }),
    formData(),
    asyncContext(),
    loadAssetEntry(),
    render(),
  ],
});
```

Keep the shared shell in `app/ui/document.tsx`:

```tsx filename=app/ui/document.tsx
import type { Handle, RemixNode } from "remix/ui";

import { getAssetEntry } from "../middleware/asset-entry.ts";

interface DocumentProps {
  children?: RemixNode;
  description?: string;
  title: string;
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, description, title } = handle.props;
    let { scriptPreloads, scriptSrc, stylesheetHref } = getAssetEntry();

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {description ? (
            <meta name="description" content={description} />
          ) : null}
          <link rel="stylesheet" href={stylesheetHref} />
          {scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <title>{title}</title>
        </head>
        <body>
          {children}
          <script type="module" src={scriptSrc}></script>
        </body>
      </html>
    );
  };
}
```

The asset helper keeps public URLs and preload discovery out of the component. The document decides where the stylesheet, module preloads, and browser entry script belong.

`createHtmlResponse()` wraps the renderer's string or stream with `Content-Type: text/html; charset=utf-8` and ensures the output begins with a doctype. Status codes, cache headers, and other response policy still come from the `ResponseInit` passed to `context.render(...)`.

## Styling with css and dynamic style values {#styling-with-css}

Use `css(...)` for rules that are stable across renders. It supports selectors, media queries, and keyframes, then returns a mixin for the element's `mix` prop:

```tsx filename=app/actions/albums/album-card.tsx
import { css } from "remix/ui";

const cardStyle = css({
  display: "grid",
  gap: "0.75rem",
  border: "1px solid #d6d6d6",
  borderRadius: "1rem",
  padding: "1rem",
  "&:hover": {
    borderColor: "#d83a5a",
  },
  "@media (max-width: 40rem)": {
    borderRadius: 0,
  },
});

// inside the render function:
return <article mix={cardStyle}>{/* ... */}</article>;
```

The server renderer collects rules created by `css(...)` and emits them together in `<head>`. It does not add a new style element beside every component.

Use the ordinary `style` prop for a value that changes frequently:

```tsx
<div
  aria-label={`${progress}% uploaded`}
  role="progressbar"
  style={{ width: `${progress}%` }}
/>
```

This keeps one generated rule for the stable appearance while the browser updates only the changing property. Prefer CSS selectors for browser-owned states such as `:hover`, `:focus-visible`, `:checked`, and media queries instead of copying them into component state.

::frame{src="/examples/04-rendering-ui/styling-card/"}

## Cascade layers and app-owned design tokens {#theme-tokens-and-cascade-layers}

Rules generated by Remix UI live in the `rmx` cascade layer. Declare your layer order once in app CSS when resets or theme rules need a predictable relationship to those generated styles:

```css filename=app/assets/base.css
@layer reset, rmx, theme, overrides;

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}

@layer theme {
  :root {
    --color-accent: #d83a5a;
    --space-page: clamp(1rem, 4vw, 3rem);
  }
}
```

Unlayered app CSS outranks layered rules, so either use deliberate layers or reserve unlayered rules for intentional final overrides.

Remix provides the `css(...)` machinery, not an application theme. Colors, spacing, typography, shadows, and product-specific tokens stay in app-owned CSS custom properties or TypeScript values.

## First-party UI building blocks {#first-party-ui-components}

The `remix/ui/*` subpaths provide three levels of reuse. Pick the level that owns no more markup than your design wants:

| Level               | Examples                                   | What the app still owns                    |
| ------------------- | ------------------------------------------ | ------------------------------------------ |
| Style mixins        | button, input, checkbox, radio, toggle     | Native markup, labels, layout, behavior    |
| Composed controls   | accordion, breadcrumbs, menu, select, tabs | Placement and surrounding product UI       |
| Headless primitives | popover, listbox, anchor, `*/primitives`   | Markup, styles, and accessible composition |

The package README for each control is the complete API reference. Here we will focus on how the levels fit into an app.

### Style mixins for native controls {#style-mixins-keep-native-controls-native}

Style mixins preserve the platform element. The button mixin, for example, can style a real `<button>` without replacing its submit, disabled, focus, or keyboard behavior:

```tsx
import { css } from "remix/ui";
import button from "remix/ui/button";

const dangerStyle = css({ color: "#b42318" });

function AlbumActions() {
  return () => (
    <div>
      <button mix={button({ tone: "primary" })} type="submit">
        Save album
      </button>
      <button mix={[dangerStyle, button({ tone: "ghost" })]} type="button">
        Delete draft
      </button>
    </div>
  );
}
```

The same pattern applies to inputs, checkboxes, radios, and toggles: keep the native element and compose the shared visual treatment through `mix`.

::frame{src="/examples/04-rendering-ui/button-component/"}

### Composed controls for common interactions {#composed-components-cover-common-product-ui}

Composed controls supply the markup and interaction for a recognizable widget. An accordion wires triggers to panels, manages open values, and implements keyboard movement:

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "remix/ui/accordion";

function AlbumDetails() {
  return () => (
    <Accordion defaultValue="credits">
      <AccordionItem value="credits">
        <AccordionTrigger>Credits</AccordionTrigger>
        <AccordionContent>Produced by Quincy Jones.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="release">
        <AccordionTrigger>Release</AccordionTrigger>
        <AccordionContent>Released November 30, 1982.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

Use `defaultValue` when the control owns its initial state. Use `value` plus `onValueChange` when an owning component must coordinate it. Controls such as select and combobox use hidden native inputs where form participation is part of their contract, so the server still receives named form values.

::frame{src="/examples/04-rendering-ui/accordion-overview/"}

### Headless primitives for custom markup {#primitives-keep-behavior-reusable-when-markup-changes}

Drop to primitives when the app must own the DOM structure or styling. The accordion, combobox, menu, select, tabs, and toggle packages expose `/primitives` subpaths, while popover, listbox, and anchor are already low-level building blocks.

Primitive composition carries more responsibility. Keep native semantics where they fit, preserve accessible names, and do not remove focus or keyboard behavior supplied by the primitive. Start with the composed control, then move down only when its markup prevents the design you need.

::frame{src="/examples/04-rendering-ui/accordion-primitives/"}

## Rendering HTML without the component runtime {#rendering-html-without-the-component-runtime}

Not every HTML response needs a component tree. An RSS preview, an email body, or a small utility page may be clearer as a template string.

`remix/html-template` escapes interpolated values and brands the result as safe HTML:

```ts filename=app/actions/albums/feed.ts
import { html } from "remix/html-template";
import { createHtmlResponse } from "remix/response/html";

export function renderAlbumList(albums: Array<{ id: string; title: string }>) {
  let body = html`
    <main>
      <h1>Albums</h1>
      <ul>
        ${albums.map(
          (album) => html`<li data-album-id="${album.id}">${album.title}</li>`,
        )}
      </ul>
    </main>
  `;

  return createHtmlResponse(body);
}
```

If an album title contains `<` or `&`, the template escapes it. `SafeHtml` fragments compose without double escaping. `html.raw` bypasses escaping, so reserve it for markup the app already trusts, never a form value, database field, or third-party response.

The page now renders on the server with a complete document, collected styles, and optional streamed frames. Next, [Interactivity](/interactivity/) starts the browser runtime and adds behavior to the smallest components that need it.
