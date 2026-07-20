---
title: Interactivity
description: How server-rendered UI hydrates, handles events, connects components to application models, navigates, and cancels stale work.
---

In [Start Here](/start-here/), the album page, edit form, validation, mutation, and redirect all
worked before we added browser JavaScript. Then we marked the form as a client entry so its submit
button could show pending state.

This chapter adds browser behavior to server-rendered components. We will mark a component for
hydration, start the browser runtime, update local UI state, handle events, cancel stale async work,
and enhance links and forms. For application state and business rules, components call ordinary
TypeScript models and keep their own state focused on the UI.

## Progressive enhancement {#progressive-enhancement}

Begin with links and forms that already describe the request the server should receive. Our album
form has a real action and method:

```tsx filename=app/actions/albums/edit/album-edit-form.browser.tsx
import type { Handle } from "remix/ui";

import { routes } from "../../../routes.ts";
import type { Album } from "../data.ts";

export function AlbumEditForm(handle: Handle<{ album: Album }>) {
  return () => {
    let { album } = handle.props;

    return (
      <form action={routes.albums.edit.action.href({ albumId: album.id })} method="post">
        <label>
          Title
          <input defaultValue={album.title} name="title" required />
        </label>
        <label>
          Artist
          <input defaultValue={album.artist} name="artist" required />
        </label>
        <label>
          Year
          <input defaultValue={album.year} name="year" required type="number" />
        </label>
        <button type="submit">Save album</button>
      </form>
    );
  };
}
```

With no JavaScript, the browser posts `FormData` to the route. The action validates it, updates the
album, and returns a redirect. With JavaScript, an event handler can intercept that same submission
to add pending UI or reload part of the page. The controller still owns the mutation and every error
response.

Use the same rule for navigation. Render an anchor with a useful `href` first, then let the browser
runtime enhance same-origin navigation when it is available.

Some interactions only make sense with JavaScript. The server can still render the useful content,
navigation, and forms around them. Give each hydrated component the serializable data and route URLs
it needs rather than moving the whole page into browser code.

## Hydration boundaries with clientEntry {#cliententry}

`clientEntry(...)` marks the smallest component that needs to run in the browser. The album edit page
can remain server-only while its form hydrates:

```tsx filename=app/actions/albums/edit/album-edit-form.browser.tsx lines=[1,6-10,13]
import { clientEntry } from "remix/ui";
import type { Handle } from "remix/ui";

import { routes } from "../../../routes.ts";
import type { Album } from "../data.ts";

export const AlbumEditForm = clientEntry(
  import.meta.url,
  function AlbumEditForm(handle: Handle<{ album: Album }>) {
    return () => {
      let { album } = handle.props;

      return (
        <form action={routes.albums.edit.action.href({ albumId: album.id })} method="post">
          {/* fields */}
        </form>
      );
    };
  },
);
```

On the server, this still renders like an ordinary component. In the browser, Remix loads the same
component module and starts it with the props from the server-rendered page.

Client-entry props cross from the server to the browser, so they must be serializable. They may
contain strings, numbers, booleans, `null`, `undefined`, plain objects and arrays, and JSX elements.
Do not pass functions, class instances, database records with custom prototypes, or other opaque
runtime values.

Mark a boundary around interactive UI, not an entire page by habit. Static ancestors and siblings do
not need to hydrate just because a button below them does. Keep the database, authenticated user,
and request context on the server. Pass the client entry plain initial data, route URLs, and other
browser-safe values it needs to handle its part of the page.

## Booting the browser runtime with run {#browser-entry-with-run}

The document shell loads `app/assets/entry.ts`. That module calls `run()` once:

```ts filename=app/assets/entry.ts
import { run } from "remix/ui";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(moduleUrl);
    return module[exportName];
  },
});

app.addEventListener("error", (event) => {
  console.error("Component error:", event.error);
});

await app.ready();
```

`loadModule` imports the named component for every client entry discovered in the document.

The returned app runtime has three lifecycle methods:

- `app.ready()` resolves after the initial client entries hydrate.
- `app.flush()` synchronously applies pending component updates. This is mainly useful in tests and
  integrations that must observe the DOM immediately.
- `app.dispose()` removes the runtime's components and listeners.

`run()` hydrates the server-rendered page. It is not a second application router. Browser requests
still go to the route actions that own the corresponding server behavior.

[Streaming UI with Frames](/streaming-ui-with-frames/) adds the optional `resolveFrame` callback when
the app needs route-owned regions that load or reload independently.

## Mount client-only UI with createRoot {#client-only-roots}

Use `createRoot(container)` when there is no server-rendered component to hydrate: for example, an
imperative widget mounted into a container created by another application.

```tsx filename=app/assets/support-widget.tsx
import { createRoot } from "remix/ui";
import type { Handle } from "remix/ui";

function SupportWidget(_handle: Handle) {
  return () => <a href="/support">Contact support</a>;
}

let container = document.getElementById("support-widget");

if (container) {
  let root = createRoot(container);
  root.render(<SupportWidget />);

  window.addEventListener("pagehide", () => root.dispose(), { once: true });
}
```

The root owns that container. `root.render(node)` schedules a tree, `root.flush()` applies pending
work synchronously, and `root.dispose()` removes the tree and runs cleanup. Normal page UI should
start on the server and use `clientEntry(...)`; otherwise users wait for JavaScript before they see
content the server could have rendered.

## State, updates, and post-render tasks {#state-updates-and-post-render-tasks}

Component-local UI state lives in setup scope. Change it in an event handler, then call
`handle.update()`:

```tsx
import { on } from "remix/ui";
import type { Handle } from "remix/ui";

function Counter(handle: Handle<{ initialCount: number }>) {
  let count = handle.props.initialCount;

  return () => (
    <button
      mix={on("click", () => {
        count++;
        handle.update();
      })}
      type="button"
    >
      Count: {count}
    </button>
  );
}
```

`initialCount` initializes local state once. If a value should always follow its parent, read it from
`handle.props` in render instead. This is the difference between an uncontrolled value that a
component owns and a controlled value that arrives through current props.

::frame{src="/examples/05-interactivity/basic-counter/"}

::frame{src="/examples/05-interactivity/controlled-uncontrolled-values/"}

Calling `handle.update()` schedules work and returns a promise. Await it when the next step needs the
updated DOM:

```tsx
import { on, ref } from "remix/ui";
import type { Handle } from "remix/ui";

function RenameButton(handle: Handle) {
  let editing = false;
  let input: HTMLInputElement;

  return () => (
    <div>
      <button
        mix={on("click", async () => {
          editing = true;
          await handle.update();
          input.focus();
        })}
        type="button"
      >
        Rename
      </button>
      {editing && <input aria-label="Album title" mix={ref((node) => (input = node))} />}
    </div>
  );
}
```

The promise resolves to an `AbortSignal`, but capture it only if work continues across another async
boundary after the update. The runtime cannot abort the signal between `await handle.update()` and
the next synchronous statement, so `input.focus()` does not need a signal check. When more async
work follows, pass the signal to that work when possible and check it after the later `await` before
continuing:

```tsx
// Inside an async event handler:
let signal = await handle.update();
let response = await fetch(href, { signal });
if (signal.aborted) return;

status = response.ok ? "saved" : "error";
handle.update();
```

`handle.queueTask(task)` runs a task during the commit after the next update. Use it when DOM
measurement or another update must happen as part of that flush:

```tsx
// Inside an event handler after `detailsSection` has been assigned:
showDetails = true;
handle.update();
handle.queueTask(() => {
  detailsSection.scrollIntoView({ block: "nearest" });
});
```

Do not create extra state only to make a queued task notice it later. Start work in the event handler
that owns it, or key a queued task directly to the prop value it observes.

Keys matter whenever an update changes a list. Use a stable ID, not an array index that changes when
the list is sorted or a random value created during render. Matching keys let Remix move existing DOM
and component instances instead of pairing state with the wrong item.

::frame{src="/examples/05-interactivity/keyed-list/"}

Setup-scope variables are a good home for UI state such as whether a menu is open, which field has
focus, or whether a request is pending. Put business rules and shared application state in ordinary
TypeScript outside the component, then call that code from event handlers. A later section shows the
small amount of wiring needed to update a component when an application model changes.

## Events with on {#events-with-on}

`on(type, handler, capture?)` attaches a typed DOM event to a host element. The event's
`currentTarget` is inferred from that host:

```tsx
import { on } from "remix/ui";
import type { Handle } from "remix/ui";

function AlbumForm(_handle: Handle) {
  return () => (
    <form
      mix={on("submit", (event) => {
        event.preventDefault();
        let formData = new FormData(event.currentTarget);
        console.log(formData.get("title"));
      })}
    >
      {/* fields */}
    </form>
  );
}
```

Prefer native elements and their native events. A button's `click` event already covers pointer,
touch, Enter, and Space activation. A form's `submit` event covers its submit button and Enter from a
field. Use lower-level pointer or keyboard events when the interaction itself requires them, not to
rebuild behavior the platform already supplies.

Use lower-level pointer and keyboard events only when the interaction needs them. If an event starts
temporary listeners on `window` or `document`, give those listeners their own cleanup signal and
stop them when the interaction finishes or the component disconnects.

Only call `preventDefault()` when the enhanced path will finish the browser's job. If an event
handler merely adds pending state before an ordinary form submission, allow the submission to
continue.

## Composing behavior with mix {#the-mix-prop}

The `mix` prop attaches reusable behavior and styles to host elements. Pass one mixin directly, or an
array when the element needs several:

```tsx
import button from "remix/ui/button";
import { attrs, css, on, ref } from "remix/ui";
import type { Handle } from "remix/ui";

const saveButtonStyle = css({ minWidth: "8rem" });

function SaveButton(_handle: Handle) {
  return () => (
    <button
      mix={[
        button({ tone: "primary" }),
        saveButtonStyle,
        attrs({ type: "button" }),
        ref((node) => console.log("Mounted", node)),
        on("click", () => console.log("Save album")),
      ]}
    >
      Save
    </button>
  );
}
```

The core mixins serve different host-level jobs:

- `on(...)` attaches a typed event handler.
- `ref(...)` runs setup when the element is inserted and supplies a cleanup signal.
- `attrs(...)` provides default attributes without replacing explicit element props.
- `link(...)` adds client navigation behavior and link semantics.
- `css(...)` applies static generated CSS.

Animation mixins use the same prop and are covered in [Animation](/animation/). Put frequently
changing values in normal props such as `style`, `value`, `checked`, and ARIA attributes rather than
recreating static mixins for every state change.

## DOM references, global events, and cleanup {#refs-attrs-and-dom-lifecycle}

`ref(...)` receives the inserted DOM node and a signal that aborts when that node is removed. Tie
observers and element-owned listeners to that signal:

```tsx
import { ref } from "remix/ui";
import type { Handle } from "remix/ui";

function MeasuredPanel(handle: Handle) {
  let width = 0;

  return () => (
    <div
      mix={ref((node, signal) => {
        let observer = new ResizeObserver((entries) => {
          let entry = entries[0];
          if (!entry) return;
          width = Math.round(entry.contentRect.width);
          handle.update();
        });

        observer.observe(node);
        signal.addEventListener("abort", () => observer.disconnect());
      })}
    >
      Panel width: {width}px
    </div>
  );
}
```

The ref callback runs when the element is inserted, not on every component update. If an element is
conditional, its ref signal has the right lifetime for work that should stop when just that element
disappears.

For `window`, `document`, media queries, and other `EventTarget` values, use
`addEventListeners(target, signal, listeners)`. Schedule browser-only setup after the client commit
and tie it to `handle.signal`, which aborts when the component disconnects:

```tsx
import { addEventListeners, clientEntry } from "remix/ui";
import type { Handle } from "remix/ui";

export const ViewportWidth = clientEntry(import.meta.url, function ViewportWidth(handle: Handle) {
  let width: number | undefined;

  handle.queueTask(() => {
    width = window.innerWidth;
    addEventListeners(window, handle.signal, {
      resize() {
        width = window.innerWidth;
        handle.update();
      },
    });
    handle.update();
  });

  return () => <span>{width === undefined ? "Measuring…" : `${width}px`}</span>;
});
```

Scheduling the setup avoids reading `window` during server rendering. For a client-only root, setup
already runs only in the browser, so it can register the listener directly.

Some listeners need a shorter lifetime than the component. Create an `AbortController` when that
work starts, use its signal with `addEventListeners(...)`, and abort it when the work finishes. Also
abort it from `handle.signal` so navigation cannot leave temporary listeners behind.

## Async work and cancellation {#optimistic-updates-and-cancellation-with-handle-signal}

Remix gives async work an abort signal scoped to the work that created it:

| Signal                                      | Aborts when                                           | Good for                                                     |
| ------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| The second argument to an `on(...)` handler | The same handler runs again or its element is removed | Requests where the latest event should replace earlier work. |
| The argument to a queued task               | The component renders again or disconnects            | Prop-keyed loading and post-render DOM work.                 |
| `handle.signal`                             | The component disconnects                             | Component-lifetime timers and global listeners.              |

Pass the narrowest signal into `fetch()` and check it after any awaited operation that cannot accept
the signal. In this example, the server passes `routes.albums.search.href()` as `searchHref`, and the
route returns a short text result. The browser component does not hard-code the endpoint:

```tsx filename=app/ui/album-search.browser.tsx
import { clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

export const AlbumSearch = clientEntry(
  import.meta.url,
  function AlbumSearch(handle: Handle<{ searchHref: string }>) {
    let error: string | undefined;
    let loading = false;
    let resultText = "";

    return () => (
      <div>
        <input
          aria-label="Search albums"
          mix={on("input", async (event, signal) => {
            let url = new URL(handle.props.searchHref, window.location.href);
            url.searchParams.set("query", event.currentTarget.value);
            error = undefined;
            loading = true;
            handle.update();

            try {
              let response = await fetch(url, { signal });
              if (!response.ok) {
                throw new Error(`Search failed with status ${response.status}`);
              }

              let nextResultText = await response.text();
              if (signal.aborted) return;

              resultText = nextResultText;
              loading = false;
              handle.update();
            } catch (caught) {
              if (signal.aborted) return;
              error = caught instanceof Error ? caught.message : "Search failed";
              loading = false;
              handle.update();
            }
          })}
          type="search"
        />
        {error ? <p role="alert">{error}</p> : null}
        {loading ? <p>Searching…</p> : null}
        {resultText ? <p>{resultText}</p> : null}
      </div>
    );
  },
);
```

Typing again aborts the previous handler signal and its fetch. A slow response for an old query
cannot replace the newer results.

## Keep application logic outside components {#saving-a-client-owned-document}

Setup-scope variables make component state easy, but they do not make the component the right owner
for every rule. Keep state in the component when it describes the current UI: whether a panel is
open, which element should receive focus, or whether a request is pending. Put application data and
operations in ordinary TypeScript that the component calls.

A small model makes that boundary concrete. This cart owns its items and quantity changes:

```ts filename=app/ui/cart-model.ts
import { TypedEventTarget } from "remix/ui";

export interface CartItem {
  id: string;
  quantity: number;
}

export class CartModel extends TypedEventTarget<{ change: Event }> {
  #items: CartItem[];

  constructor(items: readonly CartItem[]) {
    super();
    this.#items = [...items];
  }

  get itemCount(): number {
    return this.#items.reduce((total, item) => total + item.quantity, 0);
  }

  add(productId: string): void {
    let item = this.#items.find((item) => item.id === productId);

    this.#items = item
      ? this.#items.map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
        )
      : [...this.#items, { id: productId, quantity: 1 }];

    this.dispatchEvent(new Event("change"));
  }
}
```

The component creates the model from serializable props, listens for changes, and keeps only the
open state for its details panel:

```tsx filename=app/ui/cart.browser.tsx
import { addEventListeners, clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

import { CartModel, type CartItem } from "./cart-model.ts";

interface CartProps {
  initialItems: CartItem[];
  product: { id: string; name: string };
}

export const Cart = clientEntry(import.meta.url, function Cart(handle: Handle<CartProps>) {
  let cart = new CartModel(handle.props.initialItems);
  let detailsOpen = false;

  addEventListeners(cart, handle.signal, {
    change() {
      handle.update();
    },
  });

  return () => (
    <section>
      <button mix={on("click", () => cart.add(handle.props.product.id))} type="button">
        Add {handle.props.product.name}
      </button>
      <button
        aria-expanded={detailsOpen}
        mix={on("click", () => {
          detailsOpen = !detailsOpen;
          handle.update();
        })}
        type="button"
      >
        Cart ({cart.itemCount})
      </button>
      {detailsOpen ? <p>{cart.itemCount} items in your cart.</p> : null}
    </section>
  );
});
```

`addEventListeners()` connects model changes to `handle.update()`, and `handle.signal` removes the
subscription when the component disconnects. If several components use the same model, create it at
their nearest shared client boundary and provide it through component context. Do not pass a class
instance through `clientEntry(...)` props because those props are serialized.

This separation keeps each test focused. Test cart rules without a DOM. Use a component test for the
details button and rendered item count because those depend on the component and DOM.

## Client navigation {#client-navigation}

Keep using real anchors for links. After `run()` starts, the runtime can enhance same-origin
navigations through the browser's Navigation API. Cross-origin links, downloads, and navigations the
browser cannot intercept continue as normal document requests.

```tsx filename=app/ui/album-link.tsx
import type { Handle } from "remix/ui";

import { routes } from "../routes.ts";

function AlbumLink(handle: Handle<{ albumId: string; title: string }>) {
  return () => (
    <a href={routes.albums.show.href({ albumId: handle.props.albumId })}>{handle.props.title}</a>
  );
}
```

Use `navigate(href, options)` when navigation begins in code. Apply `link(href, options)` to any HTML
host that should behave like a link, such as a card whose whole surface is interactive:

```tsx filename=app/ui/album-navigation.tsx
import { link, navigate, on } from "remix/ui";
import type { Handle } from "remix/ui";

import { routes } from "../routes.ts";

function AlbumNavigation(handle: Handle<{ albumId: string; title: string }>) {
  return () => {
    let href = routes.albums.show.href({ albumId: handle.props.albumId });

    return (
      <div>
        <article mix={link(href)}>{handle.props.title}</article>
        <button mix={on("click", () => navigate(href, { history: "replace" }))} type="button">
          Replace current album
        </button>
      </div>
    );
  };
}
```

On a non-anchor host, `link(...)` adds `role="link"`, makes the element keyboard-focusable when
needed, handles Enter and mouse or modifier-key activation, and reflects a disabled host with
`aria-disabled`. Prefer an anchor when its markup fits. Use the mixin when making another host act as
a link is an intentional part of the UI.

## Enhancing forms with fetch and navigation

Now we can enhance the album form without adding a second mutation API. The handler sends the form's
existing action, method, and `FormData`, then follows the action's redirect:

```tsx
// Inside AlbumEditForm's render function:
<form
  action={routes.albums.edit.action.href({ albumId: album.id })}
  method="post"
  mix={on("submit", async (event, signal) => {
    let form = event.currentTarget;
    event.preventDefault();
    error = undefined;
    pending = true;
    handle.update();

    try {
      let response = await fetch(form.action, {
        body: new FormData(form),
        method: form.method,
        signal,
      });

      if (signal.aborted) return;
      if (!response.ok) {
        error = await response.text();
        if (signal.aborted) return;
        pending = false;
        handle.update();
        return;
      }

      await navigate(response.url, { history: "replace" });
    } catch (caught) {
      if (signal.aborted) return;
      error = caught instanceof Error ? caught.message : "Unable to save album";
      pending = false;
      handle.update();
    }
  })}
>
  {/* The same fields from the progressively enhanced form above. */}
  <button disabled={pending} type="submit">
    {pending ? "Saving…" : "Save album"}
  </button>
  {error ? <p role="alert">{error}</p> : null}
</form>
```

The controller action has not changed. A non-enhanced submission still receives its redirect or
error response. The enhanced path consumes that response, shows an error locally when it is not
successful, and follows the controller's redirect URL with `navigate(...)`.

Choose the synchronization boundary that matches the UI:

- Submit the existing form normally when a document navigation is the right result.
- Intercept it with `fetch()` when the page needs pending or inline error UI before navigating.
- Send JSON when a browser-side model owns the data and no server-rendered region needs to change.
- Poll a small JSON endpoint when data changes independently of the current page.

[Streaming UI with Frames](/streaming-ui-with-frames/) covers the optional case where a mutation
reloads one route-owned region without navigating the whole document.

## Pending and optimistic UI {#optimistic-ui}

The album form keeps `pending` in setup scope because the render output reads it. The submit handler
sets it before the request and clears it when the request settles. That is enough for disabled
controls, pending labels, progress indicators, and duplicate-submission prevention.

Optimistic UI renders the expected result before the request completes. Put the optimistic operation
and its recovery policy in the model that owns the data. The component can render the model's current
state while keeping UI concerns such as a pending label, open menu, or focused control locally.

Optimistic state works best for reversible, predictable changes such as toggles, reordering, and
adding a known item. Wait for the response when the server chooses the final value, performs a
destructive operation, or can reject the request in ways the user must resolve first. If an
optimistic request fails, the model can restore its previous state or adopt the server response, and
the component can render the resulting error or retry control.

## When to create a custom mixin {#creating-custom-mixins}

Most application code should compose `on`, `ref`, `attrs`, `link`, `css`, and the first-party UI
mixins. Use `createMixin()` when host-element behavior has its own state and insert/remove lifecycle,
or when several components share it. Keep one-off behavior in the component with the built-in
mixins. The [`remix/ui` API overview](https://api.remix.run/api/remix/ui/overview/) covers
`createMixin()` when that reusable lifecycle is needed.

The next chapter uses the same server renderer and browser runtime to stream and reload route-owned
UI with `<Frame>`. [Animation](/animation/) then applies component state, `mix` composition, keys, and
cancellation to entrance, exit, layout, spring, and tween motion.
