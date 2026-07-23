---
title: Interactivity
description: How server-rendered UI hydrates in the browser, handles events, navigates, reloads frames, and cancels stale work.
---

In [Rendering UI](/rendering-ui/), the album page became a complete HTML response before any browser code ran. We will keep that server path and hydrate only the controls that need local state, events, navigation, or frame reloads.

The browser runtime does not introduce a second route system. Controllers still own links, forms, validation, redirects, and rendered results. Client entries enhance those same URLs and responses.

## Progressive enhancement {#progressive-enhancement}

Start with elements that already express what the browser should do. The `AlbumEditForm` from Chapter 1 should keep returning a real form with a real action:

```tsx filename=app/assets/album-edit-form.tsx
// Partial: inside AlbumEditForm's render function.
<form action={handle.props.action} method="post">
  <label>
    Title
    <input name="title" defaultValue={album.title} required />
  </label>
  <label>
    Artist
    <input name="artist" defaultValue={album.artist} required />
  </label>
  <label>
    Year
    <input name="year" defaultValue={album.year} required type="number" />
  </label>
  <button type="submit">Save album</button>
</form>
```

Without JavaScript, the browser posts the form, the controller validates it, and the action returns either the form with errors or a redirect. That is the behavior to test first.

Browser code may add pending text, submit with `fetch()`, or reload a nearby frame. It should not move validation or mutation ownership out of the controller. If the browser module fails to load, the form still has a complete request path.

The same rule applies to navigation. Use `<a href>` for a destination and `<button>` for an action. Native semantics supply focus, keyboard activation, form participation, open-in-new-tab behavior, and a useful fallback before Remix adds anything.

## Hydration boundaries with clientEntry {#cliententry}

`clientEntry(...)` marks a component whose server-rendered output should become interactive. Put that component under `app/assets/`, the directory allowed by the generated app's asset server.

Here is the counter shape from the previous chapter as a browser entry:

```tsx filename=app/assets/counter.tsx
import { clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

export const Counter = clientEntry(
  import.meta.url,
  function Counter(handle: Handle<{ initialCount: number; label: string }>) {
    let count = handle.props.initialCount;

    return () => (
      <button
        mix={on("click", () => {
          count++;
          handle.update();
        })}
        type="button"
      >
        {handle.props.label}: {count}
      </button>
    );
  },
);
```

On the server, `Counter` renders like any other component. The renderer adds entry markers and serializes the props. In the browser, the runtime imports the named `Counter` export and attaches the component to that existing DOM.

Use `import.meta.url` as the entry ID when the app serves source modules. The renderer's `resolveClientEntry(...)` hook maps that file URL to a public asset URL, keeping deployment paths out of the component.

Client entry props cross from server HTML into the browser. They may contain serializable primitives, plain objects and arrays, Remix elements, and frames. Do not pass functions, database records with class prototypes, open file handles, or other runtime-only objects.

Keep the boundary small. Hydrate the edit form or favorite button, not the complete document that happens to contain it.

::frame{src="/examples/05-interactivity/basic-counter/"}

## Booting the browser runtime with run {#browser-entry-with-run}

The document shell loads `app/assets/entry.ts`. Call `run(...)` there to hydrate every client entry in the current document:

```ts filename=app/assets/entry.ts
import type { FrameContent } from "remix/ui";
import { run } from "remix/ui";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl);
    return module[exportName];
  },
  async resolveFrame(src, signal, target): Promise<FrameContent> {
    let url = new URL(src, window.location.href);
    if (url.origin !== window.location.origin) {
      throw new Error("Refusing to render a cross-origin frame");
    }

    let headers = new Headers({ Accept: "text/html" });
    headers.set("X-Remix-Frame", "true");

    if (target) {
      headers.set("X-Remix-Target", target);
    }

    let response = await fetch(url, { headers, signal });

    if (!response.ok) {
      return "<p>Unable to load this section.</p>";
    }

    return response.body ?? response.text();
  },
});

app.addEventListener("error", (event) => {
  console.error("Remix UI error:", event.error);
});

await app.ready();
```

`loadModule(...)` imports the component export recorded during server rendering. `resolveFrame(...)` performs browser-side frame loads and reloads. It is not an application router: it asks the same server routes for HTML.

The returned runtime has three lifecycle methods:

- `app.ready()` resolves after initial client entries finish hydrating.
- `app.flush()` synchronously completes queued component updates, which is mainly useful for integration code and tests.
- `app.dispose()` removes runtime listeners and disposes the hydrated page.

Listen for the runtime's `error` event once in this entry. [Errors and Cancellation](/errors-and-error-boundaries/#error-boundaries) covers how to replace broken client UI with an app-owned fallback.

## Mount client-only UI with createRoot {#client-only-roots}

`clientEntry(...)` is the normal choice because it starts with useful server HTML. Use `createRoot(container)` when a region has no server-rendered counterpart, such as a browser-only development tool or a fallback mounted after the hydrated runtime is disposed.

```tsx filename=app/assets/dev-tools.tsx
import { createRoot } from "remix/ui";

let container = document.getElementById("dev-tools");

if (container instanceof HTMLElement) {
  let root = createRoot(container);
  root.render(<p>Development tools are connected.</p>);
  root.flush();

  window.addEventListener("pagehide", () => root.dispose(), { once: true });
}
```

The root owns that container. `render(...)` replaces its Remix node tree, `flush()` finishes pending work, and `dispose()` removes the tree. Do not create a root on top of server-rendered page content that should have been hydrated as a client entry.

## State, updates, and post-render tasks {#state-updates-and-post-render-tasks}

Component state lives in setup-scope variables. Change the value inside an event or task, then call `handle.update()`:

```tsx filename=app/assets/disclosure.tsx
import { clientEntry, on, ref } from "remix/ui";
import type { Handle } from "remix/ui";

export const Disclosure = clientEntry(
  import.meta.url,
  function Disclosure(handle: Handle) {
    let open = false;
    let panel: HTMLElement;

    return () => (
      <div>
        <button
          aria-expanded={open}
          mix={on("click", async () => {
            open = !open;
            await handle.update();

            if (open) {
              panel.focus();
            }
          })}
          type="button"
        >
          Details
        </button>
        {open ? (
          <section mix={ref((node) => (panel = node))} tabIndex={-1}>
            Album details
          </section>
        ) : null}
      </div>
    );
  },
);
```

Await `handle.update()` when the next line needs the updated DOM. For work that should run after commit but does not belong inline in the event, use `handle.queueTask(...)`.

A queued task receives an `AbortSignal`. Remix aborts it when another render invalidates the task or the component disconnects. This makes it a good boundary for prop-driven data work:

```tsx
// inside a component render function:
if (requestedAlbumId !== handle.props.albumId) {
  let albumId = handle.props.albumId;
  requestedAlbumId = albumId;

  handle.queueTask(async (signal) => {
    let response = await fetch(`/api/albums/${albumId}`, { signal });
    let value = await response.json();

    if (signal.aborted || requestedAlbumId !== albumId) return;
    album = value;
    handle.update();
  });
}
```

Do not perform fetches, DOM writes, or subscriptions directly during render. A render function should calculate and return the next node tree.

## Events with on {#events-with-on}

`on(type, handler)` attaches a typed DOM event through `mix`:

```tsx
<input
  type="search"
  value={query}
  mix={on("input", (event) => {
    query = event.currentTarget.value;
    handle.update();
  })}
/>
```

The event type determines `event.currentTarget`, so an input handler can read `.value` without a cast. The callback also accepts an `AbortSignal` as its second argument for asynchronous work.

Use the event the native control already owns. A button's `click` includes keyboard activation, a form's `submit` covers its submit button and Enter key, and an input's `input` event reflects editing. Rebuilding those semantics from pointer events usually creates gaps.

The search demo keeps only `query` in setup scope and derives its matching items during render:

::frame{src="/examples/05-interactivity/search-filter/"}

## Composing behavior with mix {#the-mix-prop}

Pass one mixin directly or an array when an element needs several:

```tsx
<button
  mix={[
    buttonStyle,
    attrs({ "data-album-id": album.id }),
    on("click", () => selectAlbum(album.id)),
  ]}
  type="button"
>
  Select {album.title}
</button>
```

The built-in mixins cover the common host-element jobs:

| Mixin        | Purpose                                              |
| ------------ | ---------------------------------------------------- |
| `on(...)`    | Typed DOM event handling                             |
| `css(...)`   | Static generated rules, selectors, and media queries |
| `ref(...)`   | Mounted element access with removal cleanup          |
| `attrs(...)` | Reusable attributes                                  |
| `link(...)`  | Frame-aware Navigation API behavior                  |

Animation mixins from `remix/ui/animation` use the same `mix` prop. Keep frequently changing visual values in ordinary props such as `style`, and keep stable behavior in mixins.

## DOM references, global events, and cleanup {#refs-attrs-and-dom-lifecycle}

Use `ref(...)` when behavior needs the mounted host element. Its callback receives the node and an abort signal tied to that element:

```tsx
<div
  mix={ref((node, signal) => {
    let observer = new ResizeObserver(() => {
      width = node.getBoundingClientRect().width;
      handle.update();
    });

    observer.observe(node);
    signal.addEventListener("abort", () => observer.disconnect());
  })}
/>
```

The ref callback runs when the element is inserted, not after every update. The signal handles a conditional element that disappears while its component remains mounted.

For `window`, `document`, media queries, or another `EventTarget`, use `addEventListeners(...)` with the signal matching the work's lifetime. Browser globals still cannot run during server setup, so connect them from a browser-only host callback such as `ref(...)`:

```tsx filename=app/assets/online-status.tsx
import { addEventListeners, clientEntry, ref } from "remix/ui";
import type { Handle } from "remix/ui";

export const OnlineStatus = clientEntry(
  import.meta.url,
  function OnlineStatus(handle: Handle) {
    let online: boolean | undefined;

    return () => (
      <span
        mix={ref((node, signal) => {
          online = navigator.onLine;
          node.textContent = online ? "Online" : "Offline";

          addEventListeners(window, signal, {
            online() {
              online = true;
              handle.update();
            },
            offline() {
              online = false;
              handle.update();
            },
          });
        })}
      >
        {online === undefined
          ? "Checking connection…"
          : online
            ? "Online"
            : "Offline"}
      </span>
    );
  },
);
```

The element signal aborts when the status node is removed, so these listeners cannot outlive it. Use `handle.signal` for a component-lifetime resource that is started from a browser callback and may outlive one host element.

## Async work and cancellation {#optimistic-updates-and-cancellation-with-handle-signal}

Remix exposes three useful cancellation scopes:

1. An `on(...)` handler signal aborts when that handler is re-entered or its mixin binding is removed.
2. A `handle.queueTask(...)` signal aborts on the next render or component removal.
3. `handle.signal` aborts only when the component disconnects.

Use the narrowest scope that owns the work. A typeahead request belongs to the input handler, so a new keystroke should cancel the previous request:

```tsx
<input
  type="search"
  mix={on("input", async (event, signal) => {
    let query = event.currentTarget.value;
    loading = true;
    handle.update();

    let response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      signal,
    });
    let nextResults = await response.json();

    if (signal.aborted) return;
    results = nextResults;
    loading = false;
    handle.update();
  })}
/>
```

Passing the signal to `fetch()` stops network and body-reading work where the browser can. Check it again before applying a result because other awaited APIs may finish after cancellation.

## Client navigation {#client-navigation}

Use an anchor when the user is going somewhere:

```tsx
<a href={routes.albums.show.href({ albumId: album.id })}>{album.title}</a>
```

Once `run()` starts, same-origin navigation can use Remix's frame-aware Navigation API path. For an app-driven transition, call `navigate(...)`. For a non-anchor host that must behave like a link, compose `link(...)`:

```tsx
import { link, navigate } from "remix/ui";

<article mix={link(routes.albums.show.href({ albumId: album.id }))}>
  <h2>{album.title}</h2>
</article>;

await navigate(routes.albums.show.href({ albumId: album.id }), {
  history: "replace",
  resetScroll: true,
});
```

Navigation options control the frame operation:

- `target` reloads a named frame instead of the top frame.
- `src` changes the URL fetched for that frame while `href` remains the history destination.
- `history` chooses `push` or `replace`.
- `resetScroll` controls whether the window scrolls back to the top once the navigation commits. It applies to new history entries, not back and forward traversals.

The corresponding HTML attributes are `rmx-target`, `rmx-src`, and `rmx-reset-scroll`. Add `rmx-document` to an anchor when the browser must perform a full document navigation instead of a Remix transition.

## Frames and partial server-rendered UI {#frames-and-partial-server-rendered-ui}

Frames let the browser ask a route for server-rendered HTML and place it into a bounded region. The album page already renders one: the named recommendations frame from [Rendering UI](/rendering-ui/#streaming-and-deferred-rendering):

```tsx
<Frame
  name="recommendations"
  src={routes.albums.recommendations.href({ albumId: handle.props.album.id })}
  fallback={<p>Loading recommendations…</p>}
/>
```

Inside a client entry, use the component handle to reload the appropriate region:

```tsx
await handle.frame.reload(); // the frame containing this component
await handle.frames.get("recommendations")?.reload(); // a named frame
await handle.frames.top.reload(); // the complete page frame
```

Frames may be blocking or render a fallback during initial server rendering, as covered in [Rendering UI](/rendering-ui/#streaming-and-deferred-rendering). They may nest, and client entries inside them hydrate normally.

On reload, the runtime matches incoming DOM to the current frame. Matching client entries receive new props while keeping their setup-scope state. Put a stable serialized `data-key` on repeated host elements when their identity matters across changes; a JSX-only `key` is not present in the incoming DOM for the frame diff to read.

## Enhancing forms with fetch and frame reloads {#coordinating-forms-fetches-frame-reloads-and-navigation}

Now we can enhance the form from the start of this chapter. The action URL, method, form fields, and controller stay the same:

```tsx filename=app/assets/album-edit-form.tsx
import { clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

export const AlbumEditForm = clientEntry(
  import.meta.url,
  function AlbumEditForm(
    handle: Handle<{
      action: string;
      artist: string;
      title: string;
      year: number;
    }>,
  ) {
    let pending = false;
    let error: string | undefined;

    return () => (
      <form
        action={handle.props.action}
        method="post"
        mix={on("submit", async (event, signal) => {
          event.preventDefault();
          pending = true;
          error = undefined;
          handle.update();

          let form = event.currentTarget;

          try {
            let response = await fetch(form.action, {
              method: form.method,
              headers: { "X-Remix-Frame": "true" },
              body: new FormData(form, event.submitter),
              signal,
            });

            if (signal.aborted) return;

            if (response.redirected) {
              window.location.assign(response.url);
              return;
            }

            if (response.status === 400) {
              await handle.frame.replace(
                response.body ?? (await response.text()),
              );
              return;
            }

            if (!response.ok) {
              error = `Save failed (${response.status})`;
              return;
            }

            await handle.frame.reload();
          } catch {
            if (signal.aborted) return;
            error = "The network request failed";
          } finally {
            if (!signal.aborted) {
              pending = false;
              handle.update();
            }
          }
        })}
      >
        <label>
          Title
          <input name="title" defaultValue={handle.props.title} required />
        </label>
        <label>
          Artist
          <input name="artist" defaultValue={handle.props.artist} required />
        </label>
        <label>
          Year
          <input
            name="year"
            defaultValue={handle.props.year}
            required
            type="number"
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save album"}
        </button>
      </form>
    );
  },
);
```

The browser entry now accepts primitive props instead of the complete album object. Update the server page to pass that flattened shape:

```tsx filename=app/actions/albums/edit/page.tsx
// Partial update to AlbumEditPage from Chapter 1.
<AlbumEditForm
  action={routes.albums.edit.action.href({ albumId: album.id })}
  artist={album.artist}
  title={album.title}
  year={album.year}
/>
```

This version preserves the clicked submitter, replaces the frame with a `400` validation response, follows a successful `303` as document navigation, and clears pending state after server and network failures. A non-redirecting success reloads the frame that owns the server-rendered result. A tiny independent widget may be better served by JSON. Pick the lighter response without creating a second mutation implementation.

## Pending and optimistic UI {#optimistic-ui}

Pending UI describes work already sent to the server. Set it before the request, disable duplicate submission where appropriate, and clear it for a response the current handler still owns.

Optimistic UI goes further by rendering the expected result before the response arrives. Keep enough information to undo the attempt:

```tsx
let previousFavorite = favorite;
favorite = !favorite;
handle.update();

let response = await fetch(action, { method: "POST", signal });

if (signal.aborted) return;
if (!response.ok) {
  favorite = previousFavorite;
  error = "Could not update favorite";
  handle.update();
  return;
}

await handle.frames.get("album-summary")?.reload();
```

The server response remains authoritative. If two users can update the same record, add an app-owned revision, ETag, or other precondition and handle conflicts explicitly. Cancellation prevents a stale handler from overwriting newer client state, but it does not resolve competing writes on the server.

## Creating custom mixins {#creating-custom-mixins}

Most components can stop with `on`, `ref`, `attrs`, `link`, `css`, and the animation mixins. Use `createMixin(...)` when several components share one host-element lifecycle or a semantic event built from lower-level events.

This small mixin selects an input's contents when it is inserted:

```tsx filename=app/assets/select-on-insert.tsx
import { createMixin } from "remix/ui";

export const selectOnInsert = createMixin<HTMLInputElement>((handle) => {
  handle.addEventListener("insert", (event) => {
    event.node.select();
  });

  return (props) => <handle.element {...props} />;
});
```

Mixin setup belongs in `insert`, cleanup belongs in `remove`, and post-commit work belongs in `handle.queueTask(...)`. Keep its render function free of side effects. The [Advanced Guides](/advanced-guides/#building-reusable-mixin-libraries) chapter builds a reusable mixin with a typed custom event.

::frame{src="/examples/05-interactivity/draggable-mixin/"}

With server routes, client entries, and cancellation working together, the next chapter adds motion to the DOM changes those components already make.
