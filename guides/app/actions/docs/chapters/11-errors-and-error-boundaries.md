---
title: Errors and Cancellation
description: How expected HTTP failures, uncaught server errors, rendering failures, client runtime errors, and aborted work propagate through Remix.
---

The album workflow now has several ways not to succeed. Invalid fields, a missing album, a stale revision, and a forbidden edit are expected request outcomes. A failed database connection or a component that throws is not. Closing the tab halfway through a request is cancellation, which should usually be quiet.

Remix keeps those cases separate. Controllers return expected `Response`s. Unexpected exceptions cross the router boundary. Server rendering and the browser runtime have explicit error hooks. Abort signals stop work that still knows how to stop.

## Return expected failures as responses {#returning-error-responses-in-controllers}

The album edit action already knows its public failure contract. Keep the lookup and owner check from Chapter 9 before parsing submitted fields:

```tsx
// Inside the existing action, before the Chapter 8 transaction:
let db = context.get(Database);
let album = await db.find(albums, context.params.albumId);
if (album === null) {
  return new Response("Album not found", { status: 404 });
}

if (album.owner_id !== context.auth.identity.id) {
  return new Response("Forbidden", { status: 403 });
}

let values = {
  artist: String(context.formData.get("artist") ?? ""),
  title: String(context.formData.get("title") ?? ""),
  year: String(context.formData.get("year") ?? ""),
  revision: String(context.formData.get("revision") ?? ""),
};
let result = s.parseSafe(albumFormSchema, context.formData);

if (!result.success) {
  return context.render(
    <AlbumEditPage
      albumId={context.params.albumId}
      csrfToken={getCsrfToken(context)}
      values={values}
      issues={result.issues}
    />,
    { status: 400 },
  );
}
```

After the cover checks and storage setup from Chapter 10, continue into the transaction from Chapter 8. Keep the artist upsert and album update together, and retain the owner predicate that Chapter 9 added:

```tsx
// Inside the existing transaction, after the artist upsert and lookup:
let write = await transaction.updateMany(
  albums,
  {
    artist_id: artist.id,
    revision: result.value.revision + 1,
    title: result.value.title,
    year: result.value.year,
    ...(newCoverKey ? { cover_key: newCoverKey } : {}),
  },
  {
    where: {
      id: album.id,
      owner_id: context.auth.identity.id,
      revision: result.value.revision,
    },
  },
);

if (write.affectedRows === 0) {
  throw new AlbumEditConflictError();
}
```

The existing `AlbumEditConflictError` catch renders the form with status `409` after the transaction rolls back. That private sentinel does not escape the action.

The `400`, `403`, `404`, and `409` results are not exceptions in the server's operation. Each response has a status and a safe body the caller can act on. Tests can assert the contract without matching an internal error class, and observability can distinguish a rejected edit from an outage.

The same rule applies to authentication failures, rate limits, unsupported media, and known upload limits. Throw only when the current layer cannot produce the response itself or when an invariant the application depends on has failed.

Do not put exception messages, SQL details, filesystem paths, or credentials into a public response. Log unexpected details at a trusted boundary and return a stable message to the caller.

## Render useful not-found responses {#not-found-and-404-responses}

A matched action can explain what is missing. The album page may render an app-owned `404` document with a link back to the catalog:

```tsx
if (album === null) {
  return context.render(
    <Document title="Album not found">
      <main>
        <h1>Album not found</h1>
        <p>The album may have been removed.</p>
        <a href={routes.home.href()}>Browse albums</a>
      </main>
    </Document>,
    { status: 404 },
  );
}
```

An unmatched URL never reaches that action. By default, the router returns `Not Found: /path` with status `404`. Add a default handler when the app needs its normal document shell.

This is one more option on the existing router, not a replacement router. Keep its cumulative middleware in order: `staticFiles()`, `cop()`, `uploadErrors()`, the bounded `formData()`, `methodOverride()`, `asyncContext()`, database, album-covers, session, CSRF, auth, asset-entry, and render middleware. Keep every controller mapping too:

```tsx
// Inside the existing createRouter({ ... }) options, after `middleware`:
defaultHandler(context) {
  return context.render(
    <Document title="Page not found">
      <main>
        <h1>Page not found</h1>
        <a href={routes.home.href()}>Go home</a>
      </main>
    </Document>,
    { status: 404 },
  );
},
```

The default handler runs when no route matches both the URL and request method. Add an explicit method policy if the app should distinguish a known path with the wrong method as `405 Method Not Allowed`.

A route-specific `404` and the router default know different things. The former knows which album lookup failed. The latter should not guess or disclose internal route information.

## Handle uncaught action and middleware errors at the server boundary {#uncaught-server-errors}

`router.fetch()` rejects when an action or middleware throws. Keep the app reporter in a shared server-only module so the adapter and renderer use the same boundary:

```ts filename=app/errors.ts
export function reportError(
  error: unknown,
  details: Record<string, string> = {},
) {
  console.error(details, error);
}
```

The Node adapter accepts an `onError` handler for uncaught request failures:

```ts filename=server.ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { reportError } from "./app/errors.ts";
import { router } from "./app/router.ts";

let requestListener = createRequestListener(
  (request) => router.fetch(request),
  {
    onError(error) {
      reportError(error);

      return new Response("Internal Server Error", {
        status: 500,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    },
  },
);

let server = http.createServer(requestListener);
server.listen(44100);
```

The handler receives the thrown value, not the `Request`, so attach request IDs and route context earlier if the reporter needs them. It may return a generic `Response`. Returning nothing uses the adapter's default `500`.

The adapter does not call this handler for its recognized request-abort reasons. If the response has already started and its body later fails, the adapter can report the error and close the connection, but it cannot replace bytes the client already received with a new error page.

Avoid catching the same error at every layer. If route middleware translates an exception into a `Response`, the adapter sees a successful router result and its `onError` hook does not run. Report at the layer that owns the useful context, then mark or deduplicate when the same streaming error can surface at more than one boundary.

## Report streaming render failures {#streaming-render-errors}

Add rendering reports where `renderToStream()` is created. In the renderer from [Rendering UI](/rendering-ui/#rendering-pages-through-request-context), keep the request signal and frame and client-entry resolvers, then replace the placeholder error hook with the app reporter:

```tsx
// In app/middleware/render.tsx, add this module-scope import:
import { reportError } from "../errors.ts";

// inside renderToStream(node, { ... })
signal: context.request.signal,
onError(error) {
  reportError(error, { boundary: "server-render" });
},
```

Passing `context.request.signal` lets the renderer recognize the request's exact abort reason and suppress it from `onError`.

Failure timing matters in a streaming response:

| Failure                                   | Result                                                          |
| ----------------------------------------- | --------------------------------------------------------------- |
| Root or blocking render fails             | `onError` runs and reads from the response body reject          |
| A later non-blocking frame fails          | `onError` runs and the rendered fallback remains                |
| A streamed frame tail fails after output  | `onError` runs; already-sent content cannot be replaced         |
| The request signal aborts with its reason | rendering cancels without reporting that reason as an app error |

A root rendering failure may reject the response body after `router.fetch()` has returned its `Response`. The Node adapter can therefore observe it too. Use one reporting function with deduplication rather than assuming each failure crosses only one hook.

## Own frame-resolution failures {#frame-resolution-errors}

The browser's `resolveFrame` hook owns the policy for frame HTTP responses. `fetch()` rejects for network and abort failures, not for a `404` or `500`, so check the status explicitly:

```ts filename=app/assets/entry.ts
import type { FrameContent } from "remix/ui";

async function resolveFrame(
  src: string,
  signal?: AbortSignal,
  target?: string,
): Promise<FrameContent> {
  let url = new URL(src, window.location.href);
  if (url.origin !== window.location.origin) {
    throw new Error("Refusing to render a cross-origin frame");
  }

  let headers = new Headers({ Accept: "text/html" });
  headers.set("X-Remix-Frame", "true");
  if (target) headers.set("X-Remix-Target", target);

  let response = await fetch(url, { headers, signal });
  let responseUrl = new URL(response.url || url.href);
  if (responseUrl.origin !== window.location.origin) {
    throw new Error("Refusing to render a cross-origin frame response");
  }

  if (response.status === 401) {
    let location = response.headers.get("X-Login-Location");
    if (location === null) {
      throw new Error(
        "Frame authentication response is missing a login location",
      );
    }

    let loginUrl = new URL(location, responseUrl);
    if (loginUrl.origin !== window.location.origin) {
      throw new Error("Refusing a cross-origin login location");
    }
    window.location.assign(loginUrl.href);
    return "<p>Redirecting to sign in…</p>";
  }

  if (!response.ok) {
    return '<p role="alert">Could not load this section. Reload the page to try again.</p>';
  }

  if (response.body) return response.body;
  return await response.text();
}
```

An authentication response may need a top-level login navigation. When `X-Remix-Frame` is present, protected actions return `401` plus an app-owned relative `X-Login-Location`. A normal `303` would be followed by `fetch()` before the resolver could inspect it, leaving the login document inside the frame.

The resolver requires that header and validates it before navigating. It also rejects a cross-origin final response after browser-followed redirects.

A bounded content failure can keep the rest of the page usable. A network failure or malformed frame stream may instead reject and reach the runtime error listener.

Return a Remix node or a fixed trusted string for fallback content. Do not concatenate a response body or URL into raw HTML. Preserve a successful response's body stream instead of buffering it.

If server frame resolution follows redirects internally, validate the initial URL and every redirect against the outer request's origin before forwarding its cookie. Bound the redirect count, resolve relative locations against the current frame URL, and keep the outer request signal.

## Handle browser runtime errors at the app root {#error-boundaries}

The runtime returned by `run()` is the app-wide browser error-reporting surface. Register its listener before awaiting hydration:

```ts filename=app/assets/entry.ts
import { run } from "remix/ui";

function reportBrowserError(error: unknown) {
  console.error(error);
}

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl);
    return module[exportName];
  },
  resolveFrame,
});

let failed = false;
app.addEventListener("error", (event) => {
  if (failed) return;
  failed = true;

  reportBrowserError(event.error);
  app.dispose();

  let heading = document.createElement("h1");
  heading.textContent = "Something went wrong";

  let message = document.createElement("p");
  message.textContent = "Reload the page to try again.";

  let reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Reload";
  reload.addEventListener("click", () => window.location.reload());

  let fallback = document.createElement("main");
  fallback.setAttribute("role", "alert");
  fallback.append(heading, message, reload);
  document.body.replaceChildren(fallback);
});

app.ready().catch(() => {
  // Initial hydration also emits `error`; the listener above already reported it.
});
```

The event's `error` is `unknown`, because JavaScript may throw any value. Normalize it inside the reporter and keep the public message generic. Initial hydration both emits an error event and rejects `ready()`, so handle the promise without logging the same failure twice.

This is an app-root runtime boundary, not a per-component React-style error boundary. It receives hydration, component render, scheduler, and frame failures.

A local component should model an expected fetch failure as state. It should not throw merely to reach the app root.

## Treat request aborts as cancellation {#aborts-request-signal-and-the-router}

The Node adapter aborts the Web `Request` when the client disconnects. The router races handlers against that signal and rejects with the exact `request.signal.reason`:

```ts
async function loadRecommendations(context) {
  let response = await fetch(recommendationsUrl, {
    signal: context.request.signal,
  });

  return Response.json(await response.json());
}
```

Pass the signal to APIs that support cancellation: downstream `fetch`, rendering, stream readers, and storage or database clients with a signal option. Do not replace it with a new `AbortController` unless you intentionally combine lifetimes.

Cancellation stops waiting and response work that observes the signal. It does not undo a database statement that already committed, retract an email already sent, or guarantee that a library with no signal support stops computing.

The data-table APIs in this guide do not accept a request signal. Use a transaction for atomicity and design mutation retries around idempotency, not around browser connection state.

If application code catches broadly, rethrow the request's abort reason instead of translating it into a `500`:

```ts
try {
  return await buildResponse(context);
} catch (error) {
  if (
    context.request.signal.aborted &&
    error === context.request.signal.reason
  ) {
    throw error;
  }
  reportError(error, { boundary: "caught-request" });
  return new Response("Internal Server Error", { status: 500 });
}
```

## Match component cleanup to the work's lifetime {#cancellation-in-components-with-handle-signal}

Browser components have several useful lifetimes:

| Signal                              | Aborted when                                          |
| ----------------------------------- | ----------------------------------------------------- |
| `on(type, (event, signal) => ...)`  | the handler re-enters or its mixin binding is removed |
| `await handle.update()`             | the component renders again or is removed             |
| `handle.queueTask((signal) => ...)` | the component renders again or is removed             |
| `ref((node, signal) => ...)`        | that host element is removed                          |
| `handle.signal`                     | the component disconnects                             |

Use the narrowest signal that owns the work. A typeahead belongs to its input event, so each new keystroke aborts the prior request.

First add the route beside the other direct album leaves:

```ts filename=app/routes.ts
// Inside the existing albums route map:
search: get("/albums/search"),
```

The existing `albumsController` mapping owns that new leaf, so add a matching action. Keep the controller's existing `requireUser` middleware and other actions:

```tsx filename=app/actions/albums/controller.tsx
import { and, eq, ilike } from "remix/data-table";

// Add inside the existing actions object:
async search(context) {
  let query = (context.url.searchParams.get("q") ?? "").trim();
  if (query === "") return Response.json([]);
  if (query.length > 100) {
    return Response.json(
      { error: "Search query is too long" },
      { status: 400 },
    );
  }

  let matches = await context.get(Database).findMany(albums, {
    where: and(
      eq("owner_id", context.auth.identity.id),
      ilike("title", `%${query}%`),
    ),
    orderBy: ["title", "asc"],
    limit: 10,
  });

  return Response.json(
    matches.map((album) => ({ id: album.id, title: album.title })),
  );
},
```

Render the browser entry from the album page with the typed URL:

```tsx filename=app/actions/albums/show-page.tsx
import { AlbumSearch } from "../../assets/album-search.tsx";

// Inside AlbumPage's document body:
<AlbumSearch searchHref={routes.albums.search.href()} />;
```

Now implement the browser side:

```tsx filename=app/assets/album-search.tsx
import { clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

interface Album {
  id: string;
  title: string;
}

export const AlbumSearch = clientEntry(
  import.meta.url,
  function AlbumSearch(handle: Handle<{ searchHref: string }>) {
    let results: ReadonlyArray<Album> = [];
    let message = "";

    return () => (
      <section>
        <input
          aria-label="Search albums"
          mix={on("input", async (event, signal) => {
            let query = event.currentTarget.value.trim();
            if (query === "") {
              results = [];
              message = "";
              await handle.update();
              return;
            }

            try {
              let url = new URL(handle.props.searchHref, window.location.href);
              url.searchParams.set("q", query);
              let response = await fetch(url, { signal });
              if (signal.aborted) return;
              if (!response.ok)
                throw new Error(`Search failed: ${response.status}`);

              let nextResults: ReadonlyArray<Album> = await response.json();
              if (signal.aborted) return;

              results = nextResults;
              message = "";
              await handle.update();
            } catch {
              if (signal.aborted) return;
              message = "Search is unavailable";
              await handle.update();
            }
          })}
        />
        {message ? <p role="alert">{message}</p> : null}
        <ul>
          {results.map((album) => (
            <li data-key={album.id}>{album.title}</li>
          ))}
        </ul>
      </section>
    );
  },
);
```

Use the signal returned by `await handle.update()` for asynchronous DOM work that belongs to the just-rendered tree. Use `ref` for observers attached to one element, and `handle.signal` for setup-scope resources such as a component-owned `EventSource`.

Cancellation is normal control flow. Expected HTTP failures remain responses, unexpected errors reach explicit reporting boundaries, and stale work stops at the lifetime that owns it. [Testing](/testing/) shows how to exercise those response contracts and browser failures without relying on production reports.
