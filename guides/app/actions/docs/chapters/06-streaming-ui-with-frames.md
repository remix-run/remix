---
title: Streaming UI with Frames
description: How to stream and reload route-owned UI with Frame, fallbacks, and server and browser frame resolvers.
---

The album page from [Rendering UI](/rendering-ui/) returns one component tree, and the enhanced form
from [Interactivity](/interactivity/) navigates after it saves. Keep those simpler paths until one
region of a page benefits from its own request.

This chapter moves album recommendations behind a `GET` route, streams them into the page with
`<Frame>`, and reloads that region without navigating the whole document.

## Use a frame for route-owned UI

A component does not need a frame merely because it is slow or interactive. Start with normal
component composition. Reach for a frame when a region should have its own route and at least one of
these behaviors:

- it can arrive after the surrounding page;
- it needs to reload independently after a mutation;
- several pages render the same route-owned region; or
- its data and error response belong to a separate request.

Add a recommendations route next to the album route:

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

Now the page can render that route with `Frame`:

```tsx filename=app/actions/albums/show-page.tsx
import { Frame } from "remix/ui";
import type { Handle } from "remix/ui";

import { routes } from "../../routes.ts";
import { Document } from "../../ui/document.tsx";
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
not a generic error boundary; the frame resolver and app error handling still decide what happens
when the request fails.

## Render the response as a stream {#server-rendering-with-rendertostream-and-rendertostring}

The generated render middleware uses `renderToStream()` for normal HTML responses. Most actions use
it indirectly through `context.render(...)`.

The frame-related part of that middleware supplies the current request URL, its cancellation signal,
and a resolver that sends frame URLs back through the app router:

```tsx filename=app/middleware/render.tsx
import { createHtmlResponse } from "remix/response/html";
import { renderToStream } from "remix/ui/server";

// Inside the request-scoped render function:
let stream = renderToStream(node, {
  frameSrc: request.url,
  signal: request.signal,
  resolveFrame(src, target) {
    return resolveFrame(router, request, src, target);
  },
  // Keep the app's existing resolveClientEntry and onError options here.
});

return createHtmlResponse(stream, init);
```

The resolver makes a normal request to the route from the first section. Forward the cookie when
frames share the document's session:

```ts filename=app/middleware/render.tsx
import type { Router } from "remix/router";

async function resolveFrame(router: Router, request: Request, src: string, target?: string) {
  let headers = new Headers({ Accept: "text/html" });
  let cookie = request.headers.get("Cookie");
  if (cookie) headers.set("Cookie", cookie);
  if (target) headers.set("X-Remix-Target", target);

  let response = await router.fetch(
    new Request(new URL(src, request.url), {
      headers,
      signal: request.signal,
    }),
  );

  if (!response.ok) {
    throw new Error(`Frame request failed with status ${response.status}`);
  }

  return response.body ?? response.text();
}
```

`renderToString()` is the smaller alternative when code needs the complete HTML value before it can
continue, such as an email preview or a small embedded fragment:

```tsx
import { renderToString } from "remix/ui/server";

// After loading recommendations:
let html = await renderToString(<AlbumRecommendations albums={recommendations} />);
```

Use the app's streaming renderer for normal page responses. It supports client entries and lets
frames with fallbacks arrive after the initial HTML.

## Resolve frames in the browser

A blocking frame resolves before the browser receives the page. A frame with a fallback may still
be pending, and any frame can reload later. Add `resolveFrame` to the browser's `run()` options for
those requests:

```ts filename=app/assets/entry.ts
import { run } from "remix/ui";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl);
    return module[exportName];
  },
  async resolveFrame(src, signal, target) {
    let headers = new Headers({ Accept: "text/html" });
    if (target) headers.set("X-Remix-Target", target);

    let response = await fetch(src, {
      credentials: "same-origin",
      headers,
      signal,
    });

    if (!response.ok) {
      throw new Error(`Frame request failed with status ${response.status}`);
    }

    return response.body ?? response.text();
  },
});

app.addEventListener("error", (event) => {
  console.error(event.error);
});
```

Only return trusted HTML from `resolveFrame`. Same-origin route URLs are the normal choice. The
resolver receives an abort signal, so pass it to `fetch()` instead of letting a removed or superseded
frame request continue.

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

## Reload a frame after a form submission {#coordinating-forms-fetches-frame-reloads-and-navigation}

Start with a form whose action works without browser JavaScript. A client entry can intercept that
same submission, send its `FormData`, and reload a related frame after the action succeeds:

```tsx
import { on } from "remix/ui";

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

This keeps the mutation in its existing action and the recommendations HTML in its existing `GET`
action. The browser component coordinates the two requests without duplicating either server path.

Use a normal navigation when the whole page should change. Use a browser-side model and JSON when
the client owns a document-shaped draft. A frame is useful when the server already owns the HTML for
one region and that region needs an independent request.

## Target a frame from a link

A link can keep its public destination in `href` while loading a smaller route into a named frame:

```tsx
// Inside a component that renders an album link:
<a
  href={routes.albums.show.href({ albumId: album.id })}
  rmx-src={routes.albums.recommendations.href({ albumId: album.id })}
  rmx-target="album-recommendations"
  rmx-reset-scroll="false"
>
  Show recommendations
</a>
```

`rmx-target` chooses the frame, while `rmx-src` chooses the request used to fill it. The address bar
still moves to `href`. Use `rmx-document` when a same-origin link must perform an ordinary document
navigation instead.

## Handle failures and cancellation

The server renderer's `onError` and the browser app's `error` event are reporting hooks. The app's
frame resolver decides whether a non-success response should become bounded HTML for that region or
an error reported through those hooks.

If a deferred frame fails after its fallback has been sent, the server cannot replace the whole page
with a new error response. Keep the fallback useful, report the error, and let the surrounding page
continue when that is safe.

Pass `request.signal` through server frame work and the browser resolver's signal through `fetch()`.
[Errors and Cancellation](/errors-and-error-boundaries/) covers reporting policy, while
[Production](/production/) covers disconnects, compression, and other deployment concerns.

The next chapter, [Animation](/animation/), adds motion to component insertion, removal, and layout
changes.
