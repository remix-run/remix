---
title: Streaming UI with Frames
description: How to stream and reload route-owned UI with Frame, fallbacks, and server and browser frame resolvers.
---

A `<Frame>` renders the HTML from another route inside the current page. Remix can resolve that
route before it sends the page, stream it in behind a fallback, or reload it later in the browser
without navigating the whole document.

A frame works like an [`<iframe>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe): it has a `src` URL, and the route at that URL returns HTML. Unlike an iframe, the HTML becomes part of the current document. Remix reconciles it into the live DOM instead of replacing it wholesale, so focus, input values, and the state of hydrated components inside the frame survive a reload. Because the response is plain HTML, you can read it in the browser's network panel, and a frame can load any route that returns HTML, including one that serves a static file.

This guide uses an album page with a recommendations region to cover the frame route, the render
middleware that resolves frames on the server, the browser resolver, and the links, forms, and
handlers that reload a frame. It ends with choosing between per-region frames and whole-page
navigation, and with running the same router in the browser.

## Use a frame for route-owned UI

Components render synchronously, and Remix has no async components. Data loading happens in route actions, which pass the results to components as props. A frame is how one region of a page gets its own action, and with it, its own data loading. A component does not need a frame merely because it is slow or interactive. Start with normal
component composition, a single [rendered page](/rendering-ui/#rendering-pages-through-request-context),
and [forms that navigate](/interactivity/#enhancing-forms-with-fetch-and-navigation). Reach for a
frame when a region should have its own route and at least one of these behaviors:

- It can arrive after the surrounding page.
- It needs to reload independently after a mutation.
- Several pages render the same route-owned region.
- Its data and error response belong to a separate request.

Give the region its own `GET` route. For album recommendations, that route can sit beside the album
page:

```ts filename=app/routes.ts
import { form, get, route } from "remix/routes";

export const routes = route({
  albums: route("/albums", {
    show: get("/:albumId"),
    recommendations: get("/:albumId/recommendations"),
    edit: form("/:albumId/edit"),
  }),
});
```

The action renders only the region the frame needs. It does not include the app's `Document` shell:

```tsx filename=app/actions/albums/controller.tsx
import { createController } from "remix/router";

import { routes } from "../../routes.ts";
import { getAlbum, getRecommendations } from "./data.ts";
import { AlbumRecommendations } from "./recommendations.tsx";
import { AlbumPage } from "./show-page.tsx";

export default createController(routes.albums, {
  actions: {
    async show(context) {
      let album = await getAlbum(context.params.albumId);
      if (!album) return new Response("Album not found", { status: 404 });

      return context.render(<AlbumPage album={album} />);
    },

    async recommendations(context) {
      let album = await getAlbum(context.params.albumId);
      if (!album) return new Response("Album not found", { status: 404 });

      let recommendations = await getRecommendations(album);
      return context.render(<AlbumRecommendations albums={recommendations} />);
    },
  },
});
```

The page renders that route by passing its URL to `Frame` as `src`:

```tsx filename=app/actions/albums/show-page.tsx
import { Frame } from "remix/component";
import type { Handle } from "remix/component";

import { routes } from "../../routes.ts";
import { Document } from "../document.tsx";
import type { Album } from "./data.ts";

export function AlbumPage(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props;

    return (
      <Document title={`${album.title} — Albums`}>
        <main>
          <h1>{album.title}</h1>
          <Frame src={routes.albums.recommendations.href({ albumId: album.id })} />
        </main>
      </Document>
    );
  };
}
```

Without a `fallback`, the frame is blocking. Remix waits for the recommendations response before it
sends the initial HTML chunk. The browser still receives one complete page.

## Stream a fallback first {#streaming-and-deferred-rendering}

Add `fallback` when the album page is useful before its recommendations arrive:

```tsx
<Frame
  src={routes.albums.recommendations.href({ albumId: album.id })}
  fallback={<p>Loading recommendations…</p>}
/>
```

The fallback is part of the initial HTML. When the recommendations action finishes, Remix streams
its rendered HTML and replaces the fallback.

Use a fallback for a region that may arrive later without making the surrounding page confusing.
Keep a frame blocking when the initial page does not make sense without it. A fallback is loading UI,
not a generic error boundary. The frame resolver and app error handling still decide what happens
when the request fails.

## Render the response as a stream {#server-rendering-with-rendertostream-and-rendertostring}

Frames resolve on the server through the `render()` middleware from
[`remix/middleware/render`](../src/render-middleware/README.md). Add it to your router. It
gives actions `context.render(...)`, streams their component trees, and sends frame requests back
through the same router:

```ts filename=app/router.ts
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import { assets } from "./assets.ts";

export const router = createRouter({
  middleware: [
    render({
      assets,
      onError(error) {
        console.error(error);
      },
    }),
  ],
});
```

The middleware forwards same-origin request headers needed by frame routes, strips body and
transport headers from its internal `GET` requests, follows redirects, and cancels pending frame
work when the outer request is canceled. It also uses the asset server to resolve hydrated client
entries and their module preloads.

Use `renderWith(...)` from [`remix/middleware/render`](../src/render-middleware/README.md)
when an app needs a different renderer or response type. Normal HTML actions should use the standard
`render()` middleware.

`renderToString()` from [`remix/component/server`](../src/component/server/README.md) is the
smaller alternative when code needs the complete HTML value before it can continue, such as an email
preview or a small embedded fragment:

```tsx
import { renderToString } from "remix/component/server";

// After loading recommendations:
let html = await renderToString(<AlbumRecommendations albums={recommendations} />);
```

Use `context.render(...)` for normal page responses. It streams, supports client entries, and lets
frames with fallbacks arrive after the initial HTML.

## Resolve frames in the browser

A blocking frame resolves before the browser receives the page. A frame with a fallback may still
be pending, and any frame can reload later. Calling [`run()`](/interactivity/#browser-entry-with-run)
in your browser entry installs a default browser resolver, so these requests need no additional
configuration.

The default resolver fetches same-origin HTML, follows redirects, preserves form submission methods
and encoding, and cancels requests when a frame is removed or its request is superseded. It also
keeps the redirect destination available so navigation can update the browser URL after a form saves.

Pass your own `resolveFrame` function in the `run()` options when your app needs different request
or response handling, such as another body encoding or a header that keeps frame requests on the same
deployment during a rolling deploy. The default resolver is a short `fetch()` call, so a custom one
can start from a copy of it. The
[`remix/component`](../src/component/README.md) API overview documents the callback's
arguments and return values.

Remix does not sanitize returned HTML before reconciling it into the current document, and
same-origin user-generated HTML is not implicitly safe. Sanitize untrusted content before returning it.

## Name and reload frames {#frames-and-partial-server-rendered-ui}

Give a frame a `name` when another client entry needs to find it:

```tsx
<Frame
  name="album-recommendations"
  src={routes.albums.recommendations.href({ albumId: album.id })}
  fallback={<p>Loading recommendations…</p>}
/>
```

A component can reload the frame that contains it or a named frame elsewhere on the page:

```tsx
// Reload the containing frame.
await handle.frame.reload();

// Reload a mounted frame by name.
await handle.frames.get("album-recommendations")?.reload();
```

`handle.frames.get(name)` returns `undefined` when that frame is not mounted. After a reload, Remix
updates the region with the route's current HTML. Client entries inside matching content keep their
setup state and receive current server props.

## Navigate a frame with a form

Once `run()` starts, an eligible same-origin form follows the same frame navigation path as a link.
This GET form reloads the recommendations frame without a client entry or submit handler:

```tsx
<form
  action={routes.albums.recommendations.href({ albumId: album.id })}
  method="get"
  data-rmx-target="album-recommendations"
>
  <button type="submit">Refresh recommendations</button>
</form>
```

The form remains a normal document navigation before the runtime starts. Native constraint
validation and the form's `submit` event run before Remix intercepts it. A submit button's values
take precedence over its form's values. These attributes control the navigation:

- `data-rmx-target` chooses a named frame.
- `data-rmx-src` provides a different request URL for that named frame.
- `data-rmx-reset-scroll="manual"` preserves the current scroll position.
- `data-rmx-reset-focus="manual"` disables the browser's automatic focus reset.
- `data-rmx-history="push|replace"` controls how the navigation updates history.
- `data-rmx-document` opts out of interception.

Scroll and focus controls accept `"after-transition"` (the default) and `"manual"`. Existing `"true"`
attributes keep the default behavior, and `"false"` attributes select `"manual"`. The `resetScroll` and
`resetFocus` options in `navigate()` and `link()` accept the same strings, along with `true` and `false`
for compatibility.

GET controls are already encoded in the destination URL. For non-GET forms, the default resolver
sends the form's body with its method and encoding. The action should return HTML for the targeted
frame when it receives a frame request, while keeping its normal document response or redirect for
unenhanced submissions. Non-GET submissions to the current URL replace that history entry, while GET
submissions and submissions to a different URL push one. The `data-rmx-history` attribute overrides
those defaults.

## Coordinate a mutation and a separate frame reload {#coordinating-forms-fetches-frame-reloads-and-navigation}

Start with a form whose action works without browser JavaScript. A client entry can intercept that
same submission, send its `FormData`, and reload a different route after the action succeeds:

```tsx
import { on } from "remix/component";

// Inside a client-entry component's render function:
<form
  action={routes.albums.edit.action.href({ albumId: album.id })}
  method="post"
  mix={on("submit", async (event, signal) => {
    let form = event.currentTarget;
    event.preventDefault();

    let response = await fetch(form.action, {
      body: new FormData(form),
      method: form.method,
      signal,
    });

    if (signal.aborted) return;
    if (!response.ok) {
      // Render the app's validation or request error here.
      return;
    }

    await handle.frames.get("album-recommendations")?.reload();
  })}
>
  {/* album fields */}
</form>;
```

The custom handler earns its place because the mutation response and the recommendations frame are
two different requests. The mutation stays in the edit action, the recommendations HTML stays in its
`GET` action, and the browser component only sequences them. When the form action itself returns the
HTML that belongs in the target frame, prefer `data-rmx-target` and let the runtime submit it.

Pick the update that matches the response:

- Use a normal navigation when the response should replace the whole page.
- Fetch JSON when a browser component will render the returned data itself.
- Reload a frame when a `GET` action renders the HTML for one region and only that region needs to
  update.

## Target a frame from a link

A link can keep its public destination in `href` while loading a smaller route into a named frame:

```tsx
// Inside a component that renders an album link:
<a
  href={routes.albums.show.href({ albumId: album.id })}
  data-rmx-src={routes.albums.recommendations.href({ albumId: album.id })}
  data-rmx-target="album-recommendations"
  data-rmx-reset-scroll="manual"
  data-rmx-reset-focus="manual"
>
  Show recommendations
</a>
```

`data-rmx-target` chooses a mounted named frame, while `data-rmx-src` chooses the request used to fill it.
The address bar still moves to `href`. If the target is omitted, Remix uses `href` as the top frame's
source to keep it in sync with the browser URL. If a specified target does not match a mounted frame,
the browser performs a document navigation. A supplied `data-rmx-src` must still be a valid same-origin
URL regardless of the target. Invalid or cross-origin values also disable interception.

Add `data-rmx-prefetch="intent"` or `data-rmx-prefetch="viewport"` to
[prefetch](/interactivity/#prefetch-links-before-navigation) that same source and target before
navigation. When a link attribute doesn't fit, call `prefetch(src, { target })` instead.

Add `data-rmx-history="replace"` when it should replace the current history entry. Use
`data-rmx-document` when a same-origin link must perform an ordinary document navigation instead.

These `"manual"` values disable automatic scroll restoration and focus reset during navigation.
They cannot retain focus if the update removes the focused element.

## Choose per-region frames or whole-page navigation

Once `run()` starts, every intercepted link and form already reloads the top frame, which is the whole document. Remix reconciles the new page into the current one, so client entries keep their local state and the browser keeps its scroll and focus behavior. Named frames are an addition on top of that, not a requirement. Choose between two shapes:

- **Whole-page navigation.** Render regions as ordinary components inside the page, and let links and forms reload the top frame. Each action returns a complete document, so a route's code stays in one place and doesn't need to distinguish frame requests from document requests. The cost is that every interaction renders the whole page on the server, which works best when that render is fast.
- **Per-region frames.** Give a region its own route and target it with `data-rmx-target` or `handle.frames.get(name)?.reload()`. Only that region renders and reloads. The cost is indirection: to see what a region renders, you follow its `src` to another route, and a route that serves both a full page and a named frame has to check the request. The default resolver sends `X-Remix-Frame: true` on every frame request and adds `X-Remix-Target` for named frames.

Start with whole-page navigation and move a region into its own frame when it needs to stream after the page, reload on its own, or be shared by several pages.

## Resolve frames without a server

The router doesn't have to run on a server. Routes, controllers, and middleware are built on `Request` and `Response`, so the same router can run in the browser for a client-rendered app. [`remix/spa`](../src/spa/README.md) connects it to the browser runtime:

```tsx filename=app/main.tsx
import { createRouter } from "remix/router";
import { render, run } from "remix/spa";

import { routes } from "./routes.ts";
import controller from "./actions/controller.tsx";

const router = createRouter({
  middleware: [render()],
});

router.map(routes, controller);

const app = run(router, { fallback: <p>Loading…</p> });
await app.ready();
```

Two pieces change compared to a server-rendered app:

- `render()` from [`remix/spa`](../src/spa/README.md) replaces the render middleware. Actions still call `context.render(...)` and return a `Response`, so redirects, status codes, and middleware work as before, but the rendered component tree goes straight to the browser runtime instead of being serialized to HTML. Pass `render()` a function to wrap every route in a shared layout.
- `run(router)` from [`remix/spa`](../src/spa/README.md) resolves the current URL and every later frame navigation by calling `router.fetch(...)` in the page. No request reaches the network unless an action makes one.

Controllers and routes can be shared unchanged between the two setups. What changes is the infrastructure around them: a browser can't open a database, so actions read from a browser-side store or call an API instead.

## Handle failures and cancellation

The server renderer's `onError` and the browser app's `error` event are reporting hooks. The default
browser resolver renders HTML validation responses such as `400`, but reports server errors (`500`
and above) and non-HTML error responses through the browser app's `error` event.

If a deferred frame fails after its fallback has been sent, the server cannot replace the whole page
with a new error response. Keep the fallback useful, report the error, and let the surrounding page
continue when that is safe.

Pass `request.signal` through server frame work. The default browser resolver forwards its cancellation
signal to `fetch()`, and a custom resolver should do the same.

Decide how to [report streaming render failures](/errors-and-cancellation/#streaming-render-errors)
and [frame-resolution failures](/errors-and-cancellation/#frame-resolution-errors). In production,
make sure [aborts propagate through streaming work](/production/#streaming-and-aborts) and that
[compression doesn't break streams](/production/#compression-and-streams).
