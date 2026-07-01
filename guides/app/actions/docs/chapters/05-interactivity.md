---
title: Interactivity
description: How browser behavior layers onto server-rendered Remix UI without replacing the server path.
---

## Progressive enhancement {#progressive-enhancement}

Start with the route and HTML behavior that works from the server. Add a client entry only when browser state, immediate feedback, navigation, animation, or DOM APIs improve a path that already returns the right `Response`.

A form should still have a real `action` and `method` when it mutates server state:

```tsx filename=app/ui/new-project-form.tsx
import type { Handle } from "remix/ui";

import { routes } from "../routes.ts";

export function NewProjectForm(_handle: Handle) {
  return () => (
    <form action={routes.projects.create.href()} method="post">
      <label>
        Project name
        <input name="name" required />
      </label>
      <button type="submit">Create project</button>
    </form>
  );
}
```

That form can later gain optimistic UI, pending state, or frame reloads without changing the server contract. The controller still receives a Web `Request`, reads `FormData`, validates it, and returns a `Response`.

## clientEntry {#cliententry}

`clientEntry` marks a component for hydration. The server renders it like any other component, serializes its props, and records the module/export the browser should load.

```tsx filename=app/assets/counter.tsx
import { clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

export const Counter = clientEntry(
  import.meta.url,
  function Counter(handle: Handle<{ initialCount?: number; label: string }>) {
    let count = handle.props.initialCount ?? 0;

    return () => (
      <button
        mix={[
          on("click", () => {
            count++;
            handle.update();
          }),
        ]}
        type="button"
      >
        {handle.props.label}: {count}
      </button>
    );
  },
);
```

The first argument can be `import.meta.url`. During server rendering, `resolveClientEntry` turns that file URL into the browser module URL served by your asset server. Only components marked as client entries ship browser code.

::frame{src="/docs/examples/05-interactivity/basic-counter"}

The counter source stays focused on the component. The frame route handles the demo shell, source display, and hydration wrapper.

## Browser entry with run {#browser-entry-with-run}

The browser entry starts the Remix UI runtime. `run()` finds server-rendered client entries, loads their modules, hydrates them in place, and wires frame reloads.

```ts filename=app/assets/entry.ts
import type { FrameContent } from "remix/ui";
import { run } from "remix/ui";

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl);
    return mod[exportName];
  },
  async resolveFrame(src, signal, target): Promise<FrameContent> {
    let headers = new Headers({
      Accept: "text/html",
      "X-Remix-Frame": "true",
    });

    if (target) {
      headers.set("X-Remix-Target", target);
    }

    let response = await fetch(new URL(src, window.location.href), {
      headers,
      signal,
    });
    return response.body ?? response.text();
  },
});

await app.ready();
```

`loadModule` is required because the asset server, bundler, or deployment decides how source modules become browser URLs. `resolveFrame` is optional, but frame reloads need it to fetch trusted HTML for the target frame.

## Events with on {#events-with-on}

Use the `on()` mixin for DOM events. Handlers receive the event and an `AbortSignal` that aborts when the same handler is re-entered or the component is removed.

```tsx filename=app/assets/search-box.tsx
import { clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

type SearchResult = {
  id: string;
  label: string;
};

export const SearchBox = clientEntry(
  import.meta.url,
  function SearchBox(handle: Handle) {
    let results: SearchResult[] = [];
    let loading = false;

    return () => (
      <div>
        <input
          type="search"
          placeholder="Search projects"
          mix={[
            on("input", async (event, signal) => {
              let query = event.currentTarget.value.trim();

              if (query === "") {
                results = [];
                loading = false;
                handle.update();
                return;
              }

              loading = true;
              handle.update();

              let response = await fetch(
                `/search?q=${encodeURIComponent(query)}`,
                { signal },
              );
              let data = (await response.json()) as { results: SearchResult[] };
              if (signal.aborted) return;

              results = data.results;
              loading = false;
              handle.update();
            }),
          ]}
        />
        {loading && <p>Loading…</p>}
        {results.length > 0 && (
          <ul>
            {results.map((result) => (
              <li key={result.id}>{result.label}</li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
```

Passing the signal to `fetch` prevents older requests from winning races against newer input. Keep transient values inside the event handler and store only the values that rendering needs.

::frame{src="/docs/examples/05-interactivity/search-filter"}

## Refs, attrs, and DOM lifecycle {#refs-attrs-and-dom-lifecycle}

Use `ref(...)` when browser APIs need the actual node. The callback runs when the node is inserted and receives a signal that aborts when the node is removed.

```tsx filename=app/assets/resize-tracker.tsx
import { clientEntry, ref } from "remix/ui";
import type { Handle } from "remix/ui";

export const ResizeTracker = clientEntry(
  import.meta.url,
  function ResizeTracker(handle: Handle) {
    let size = { width: 0, height: 0 };

    return () => (
      <div
        mix={[
          ref((node, signal) => {
            let observer = new ResizeObserver(([entry]) => {
              if (!entry) return;
              size = {
                width: Math.round(entry.contentRect.width),
                height: Math.round(entry.contentRect.height),
              };
              handle.update();
            });

            observer.observe(node);
            signal.addEventListener("abort", () => observer.disconnect(), {
              once: true,
            });
          }),
        ]}
      >
        Size: {size.width} × {size.height}
      </div>
    );
  },
);
```

Use `attrs(...)` inside reusable mixins when a recipe should add default host attributes. The built-in button styles use this pattern to add `type="button"` to button elements without overriding an explicit type.

Controlled props update from component state. Uncontrolled values initialize once and then belong to the DOM until a remount gives them a fresh default.

::frame{src="/docs/examples/05-interactivity/controlled-uncontrolled-values"}

## The mix prop {#the-mix-prop}

`mix` composes host-element behavior. A mixin can add attributes, styles, event listeners, refs, or lifecycle work without creating another component layer.

```tsx filename=app/ui/button-link.tsx
import { attrs, css, link } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";

export function ButtonLink(
  handle: Handle<{ children: RemixNode; href: string }>,
) {
  return () => (
    <button
      mix={[
        attrs({ type: "button" }),
        link(handle.props.href),
        css({
          border: 0,
          borderRadius: "999px",
          background: "#d83a5a",
          color: "white",
          cursor: "pointer",
          font: "inherit",
          fontWeight: "700",
          padding: "0.7rem 1rem",
        }),
      ]}
    >
      {handle.props.children}
    </button>
  );
}
```

Nested arrays are allowed, so component libraries can export style recipes such as `button()` and let callers compose them with local behavior.

Stable `key` values let Remix preserve or replace DOM nodes intentionally when a list reorders.

::frame{src="/docs/examples/05-interactivity/keyed-list"}

## Built-in mixins {#built-in-mixins}

Remix UI keeps common browser behavior in small mixins rather than special host props.

| Mixin                                             | Use                                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `on(type, handler)`                               | DOM events with signal-based interruption                                     |
| `ref(callback)`                                   | Node access and node-lifetime cleanup                                         |
| `attrs(props)`                                    | Default or reusable host attributes                                           |
| `css(rules)`                                      | Static CSS rules with nesting, pseudo-selectors, media queries, and keyframes |
| `link(href, options)`                             | Frame-aware client navigation for anchors and button-like hosts               |
| `animateEntrance`, `animateExit`, `animateLayout` | Motion tied to DOM insertion, removal, and layout changes                     |

Prefer the specific mixin over a custom abstraction until a behavior repeats enough to deserve a name.

The README examples demo collects the small runtime patterns that the package docs use as quick references.

::frame{src="/docs/examples/05-interactivity/readme-examples"}

## Creating custom mixins {#creating-custom-mixins}

Create a custom mixin when several low-level events should become one reusable behavior. A mixin can dispatch a typed custom event that components consume with `on(...)`.

```tsx filename=app/ui/press-events.tsx
import { createMixin, on } from "remix/ui";

export const pressType = "app:press" as const;

declare global {
  interface HTMLElementEventMap {
    [pressType]: PressEvent;
  }
}

export class PressEvent extends Event {
  constructor() {
    super(pressType, { bubbles: true });
  }
}

export const pressEvents = createMixin<HTMLElement>((handle) => {
  let node: HTMLElement | undefined;

  handle.addEventListener("insert", (event) => {
    node = event.node;
  });

  return () => [
    on("pointerup", () => node?.dispatchEvent(new PressEvent())),
    on("keyup", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        node?.dispatchEvent(new PressEvent());
      }
    }),
  ];
});
```

Namespace app events (`app:*`) so they do not collide with native or library events. Keep gesture state inside the mixin setup scope, and clean up timers or external listeners from the mixin signal.

A draggable mixin follows the same pattern: keep pointer state inside the mixin, use browser events directly, and let the host element decide the visual treatment.

::frame{src="/docs/examples/05-interactivity/draggable-mixin"}

## Client navigation {#client-navigation}

The browser runtime intercepts Remix-aware navigations and reloads frames instead of replacing the whole document. Use plain anchors for normal links, `link(...)` when you want to add frame-aware behavior through `mix`, and `navigate(...)` for imperative transitions.

```tsx filename=app/assets/project-link.tsx
import { clientEntry, link, navigate, on } from "remix/ui";
import type { Handle } from "remix/ui";

export const ProjectLink = clientEntry(
  import.meta.url,
  function ProjectLink(_handle: Handle) {
    return () => (
      <div>
        <a mix={link("/projects")}>Projects</a>
        <button
          mix={[
            on("click", () => {
              void navigate("/projects/new", { history: "push" });
            }),
          ]}
          type="button"
        >
          New project
        </button>
      </div>
    );
  },
);
```

Frame-targeted navigation uses the same API. Pass `target` to reload a named frame while the browser URL follows `href`; pass `src` when the frame should fetch a different route from the visible URL.

## Frames and partial server-rendered UI {#frames-and-partial-server-rendered-ui}

A `<Frame>` renders route-owned server UI inside another page. Frames can block server rendering, stream with a fallback, contain client entries, nest other frames, and reload without a full document navigation.

```tsx filename=app/ui/dashboard.tsx
import { Frame } from "remix/ui";

export function Dashboard() {
  return () => (
    <main>
      <h1>Dashboard</h1>
      <Frame src="/dashboard/summary" />
      <Frame src="/dashboard/activity" fallback={<p>Loading activity…</p>} />
    </main>
  );
}
```

No `fallback` means the server waits for the frame before it sends that part of the initial HTML. A `fallback` makes the frame non-blocking: the fallback appears first, then the real frame content streams in and replaces it.

## Coordinating forms, fetches, frame reloads, and navigation {#coordinating-forms-fetches-frame-reloads-and-navigation}

Use the smallest refresh boundary that matches the user action. A form submission that changes the current route can return a redirect. A small mutation inside a dashboard can reload one named frame and leave the rest of the document alone.

```tsx filename=app/assets/cart-row.tsx
import { clientEntry, on } from "remix/ui";
import type { Handle } from "remix/ui";

export const CartRow = clientEntry(
  import.meta.url,
  function CartRow(handle: Handle) {
    return () => (
      <form
        method="post"
        mix={[
          on("submit", async (event, signal) => {
            event.preventDefault();

            let response = await fetch(event.currentTarget.action, {
              body: new FormData(event.currentTarget),
              method: event.currentTarget.method,
              signal,
            });

            if (!response.ok || signal.aborted) return;
            await handle.frames.get("cart-summary")?.reload();
            await handle.frame.reload();
          }),
        ]}
      >
        <input name="quantity" type="number" min="1" defaultValue="1" />
        <button type="submit">Update</button>
      </form>
    );
  },
);
```

This is still progressive enhancement when the same action URL also accepts an ordinary form POST. The client handler improves the interaction by preventing a full navigation and refreshing only the UI that changed.
