---
title: Rendering UI
description: How to build pages from Remix components, props, context, document shells, styles, and first-party UI.
---

In the previous chapter, we added `render()` to the middleware stack so actions could call
`context.render(...)`. This chapter uses that function to build pages from Remix components, then
adds a document shell, styles, and first-party UI.

The component model is the same on the server and in the browser. A page does not need browser
JavaScript unless part of it handles events or uses browser APIs. We'll add that layer in
[Interactivity](/interactivity/).

## The Remix component model {#the-remix-component-model}

A Remix component is a setup function that returns a render function. Setup runs once when Remix
creates the component. Render runs immediately after setup and again whenever the component updates.

```tsx filename=app/ui/album-heading.tsx
import type { Handle } from "remix/component";

type AlbumHeadingProps = {
  artist: string;
  title: string;
};

export function AlbumHeading(handle: Handle<AlbumHeadingProps>) {
  // Setup: runs once for this component instance.

  return () => {
    // Render: runs for the initial render and every update.
    return (
      <header>
        <p>{handle.props.artist}</p>
        <h1>{handle.props.title}</h1>
      </header>
    );
  };
}
```

Render components with JSX, such as `<AlbumHeading artist="..." title="..." />`. The runtime creates
the component instance, preserves its setup scope, and calls its render function again when the
component updates.

The render function returns a `RemixNode`. That includes host elements such as `<main>`, other Remix
components, strings, numbers, booleans, `null`, `undefined`, and nested arrays of those values.
Fragments let you return siblings without adding another DOM element:

```tsx filename=app/ui/album-byline.tsx
import type { Handle } from "remix/component";

export function AlbumByline(handle: Handle<{ artist: string; year: number }>) {
  return () => (
    <>
      <span>{handle.props.artist}</span>
      <span>{handle.props.year}</span>
    </>
  );
}
```

The same component can render to HTML on the server, mount into a client-only root, or hydrate inside
a server-rendered page. Only the last two cases execute it in the browser.

::frame{src="/examples/04-rendering-ui/component-model/"}

## Props, local state, context, and updates {#handle-props-setup-render-and-updates}

Every component receives a `Handle`. `handle.props` is a stable object whose property values are
replaced before each render, so callbacks and render output should read current values from it.
Destructuring the object is safe. Destructuring one of its properties in setup captures only the
initial value.

```tsx
import type { Handle } from "remix/component";

function AlbumTitle(handle: Handle<{ title: string }>) {
  let { props } = handle;
  let initialTitle = props.title;

  return () => <h1 title={`Originally ${initialTitle}`}>{props.title}</h1>;
}
```

Local state is ordinary JavaScript declared in setup scope. Store values that affect rendering and
derive everything else inside render:

```tsx filename=app/ui/album-list.tsx
import { on } from "remix/component";
import type { Handle } from "remix/component";

type Album = {
  id: string;
  title: string;
  year: number;
};

export function AlbumList(handle: Handle<{ albums: Album[] }>) {
  let filter = "";

  return () => {
    let visibleAlbums = handle.props.albums.filter((album) =>
      album.title.toLowerCase().includes(filter.toLowerCase()),
    );

    return (
      <div>
        <input
          aria-label="Filter albums"
          mix={on("input", (event) => {
            filter = event.currentTarget.value;
            handle.update();
          })}
          type="search"
        />
        <ul>
          {visibleAlbums.map((album) => (
            <li key={album.id}>{album.title}</li>
          ))}
        </ul>
      </div>
    );
  };
}
```

The input handler changes `filter` and calls `handle.update()`. Updates are explicit: changing a
variable does not render anything until the component requests an update. Stable `key` values tell
Remix which list items are the same across renders, preserving their DOM and component state if the
list changes order. [Interactivity](/interactivity/) covers event handlers, updates, and hydration.

`handle.id` is a stable identifier for the component instance. It is useful when a reusable control
needs to connect a label, input, description, or ARIA relationship without requiring an `id` prop:

```tsx
import type { Handle } from "remix/component";

function AlbumSearch(handle: Handle) {
  return () => (
    <div>
      <label htmlFor={handle.id}>Search albums</label>
      <input id={handle.id} name="query" type="search" />
    </div>
  );
}
```

Use component context when descendants need a value that does not belong on every intermediate
component. The provider type is the context key, so `get()` remains typed:

```tsx filename=app/ui/catalog.tsx
import type { Handle, RemixNode } from "remix/component";

type CatalogContext = {
  currency: "USD" | "EUR";
};

export function Catalog(handle: Handle<{ children?: RemixNode }, CatalogContext>) {
  handle.context.set({ currency: "USD" });

  return () => handle.props.children;
}

export function AlbumPrice(handle: Handle<{ amount: number }>) {
  let catalog = handle.context.get(Catalog);

  return () => (
    <span>
      {catalog.currency} {handle.props.amount.toFixed(2)}
    </span>
  );
}
```

Calling `handle.context.set(...)` stores a value but does not schedule an update. For context that
changes in the browser, update the provider or use a `TypedEventTarget` so only consumers that listen
for the change need to update.

## Rendering pages through request context {#rendering-pages-through-request-context}

Our album controller already returns a page with `context.render(...)`:

```tsx filename=app/actions/albums/controller.tsx
import { createController } from "remix/router";

import { routes } from "../../routes.ts";
import { getAlbum } from "./data.ts";
import { AlbumPage } from "./show-page.tsx";

export default createController(routes.albums, {
  actions: {
    async show(context) {
      let album = await getAlbum(context.params.albumId);

      if (album === undefined) {
        return new Response("Album not found", { status: 404 });
      }

      return context.render(<AlbumPage album={album} />);
    },
  },
});
```

The generated app installs the render middleware once, so normal actions only call
`context.render(...)`. It also accepts a `ResponseInit` when a rendered page needs a status or
headers:

```tsx
return context.render(<AlbumPage album={album} />, {
  status: 404,
  headers: { "Cache-Control": "no-store" },
});
```

Most components do not need to know how the middleware turns their tree into a response.
[Streaming UI with Frames](/streaming-ui-with-frames/) covers the underlying server renderer and the
optional `<Frame>` API for pages that load route-owned regions independently.

## Document shells, head content, and HTML responses {#document-shells-and-head-content}

Pages should render a complete document through one shared component. The default app keeps it in
`app/actions/document.tsx`:

```tsx filename=app/actions/document.tsx
import type { Handle, RemixNode } from "remix/component";
import { ImportMap } from "remix/component/server";

import { scriptEntry } from "../assets.ts";

export interface DocumentProps {
  children?: RemixNode;
  head?: RemixNode;
  title?: string;
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = "Albums" } = handle.props;
    let { href, importMap, preloads } = scriptEntry;

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <title>{title}</title>
          {head}
          <ImportMap value={importMap} />
          {preloads.map((preloadHref) => (
            <link key={preloadHref} rel="modulepreload" href={preloadHref} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body>{children}</body>
      </html>
    );
  };
}
```

`<ImportMap>` combines the script entry's map with mappings from blocking client entries so the
initial document contains one complete import map.

Put `title`, `meta`, `link`, and `style` elements inside the document's explicit `<head>`, along with
global stylesheets, module preloads, icons, and the browser entry script. Resolve the entry href and
its module graph once in `app/assets.ts` instead of constructing an asset URL in the component.

The renderer passes this tree to `createHtmlResponse()`. That helper preserves an existing doctype or
prepends `<!DOCTYPE html>`, sets `Content-Type: text/html; charset=UTF-8` unless the action supplied
one, and returns a normal Web `Response`.

## Styling with css and dynamic style values {#styling-with-css}

Use `css(...)` for static rules. It supports pseudo-selectors, pseudo-elements, descendant and
attribute selectors, and media queries with normal CSS nesting:

```tsx filename=app/ui/album-card.tsx
import { css } from "remix/component";
import type { Handle } from "remix/component";

const cardStyle = css({
  border: "1px solid #d6d6d6",
  borderRadius: "12px",
  padding: "1rem",
  transition: "border-color 120ms ease",
  "&:hover": {
    borderColor: "#6d28d9",
  },
  "& .title": {
    marginBlock: "0 0.25rem",
  },
  "@media (max-width: 40rem)": {
    borderRadius: 0,
  },
});

export function AlbumCard(handle: Handle<{ soldOut: boolean; title: string }>) {
  return () => (
    <article mix={cardStyle} style={{ opacity: handle.props.soldOut ? 0.55 : 1 }}>
      <h2 class="title">{handle.props.title}</h2>
      <p>{handle.props.soldOut ? "Sold out" : "In stock"}</p>
    </article>
  );
}
```

The `css(...)` call creates a generated class and static rule. The `style` prop is better for values
such as progress, coordinates, opacity, or transforms that can change on every update. Putting those
values in `css(...)` would create another generated rule for each value.

During server rendering, Remix collects generated rules, deduplicates them, and inserts their
`<style data-rmx-style>` tags into the document head. A server-rendered page does not wait for browser
JavaScript to receive its component styles.

::frame{src="/examples/04-rendering-ui/styling-card/"}

## Cascade layers and app-owned design tokens {#theme-tokens-and-cascade-layers}

Generated `css(...)` rules live in the native `rmx` cascade layer. If your app uses its own layers,
declare the complete order once:

```css filename=app/actions/public/app.css
@layer base, rmx, app;

@layer base {
  :root {
    --color-accent: #6d28d9;
    --space-page: clamp(1rem, 4vw, 3rem);
  }

  body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
}

@layer app {
  .album-grid {
    display: grid;
    gap: var(--space-page);
  }
}
```

Layers before `rmx` provide defaults that generated styles can override. Layers after `rmx` can
override generated styles deliberately. Unlayered author CSS outranks normal layered CSS, so use it
intentionally when the rest of the app has an explicit layer order.

Keep brand colors, spacing, typography, radii, and other design tokens in app-owned CSS custom
properties or TypeScript values.

## Optional headless UI primitives {#headless-ui-primitives}

`@remix-run/ui` is a separate package of headless, accessible interaction primitives. The package
is currently unstable and versioned independently. It is not available through the `remix` package.
Install it when an app needs reusable behavior for controls such as accordions, comboboxes,
listboxes, menus, popovers, selects, tabs, or toggles:

```sh
npm i @remix-run/ui
```

Import each primitive from its package subpath. For example:

```tsx
import { css } from "remix/component";
import * as accordion from "@remix-run/ui/accordion";
```

The primitives supply structural attributes, keyboard interaction, focus management, and state
coordination. Your app supplies the markup and all visual styling. Controls that handle browser
events must also be inside a `clientEntry(...)` boundary, either directly or through an interactive
ancestor. The next chapter shows how to choose that boundary.

Preserve native elements when they fit, keep labels and ARIA relationships intact, and test pointer
and keyboard behavior. A custom select, for example, still needs a provider, trigger, popover,
list, options, and hidden input if it participates in a form.

::frame{src="/examples/04-rendering-ui/accordion-primitives/"}

## Rendering HTML without the component runtime {#rendering-html-without-the-component-runtime}

Not every HTML response needs a component tree. `remix/html-template` produces escaped `SafeHtml`
values for feeds, email bodies, small fragments, and other string-oriented output:

```ts filename=app/actions/albums/feed.ts
import { html } from "remix/html-template";
import { createHtmlResponse } from "remix/response/html";

import { routes } from "../../routes.ts";

export function renderAlbumFeed(albums: Array<{ id: string; title: string }>) {
  let items = albums.map((album) => {
    let href = routes.albums.show.href({ albumId: album.id });
    return html`<li><a href="${href}">${album.title}</a></li>`;
  });

  return createHtmlResponse(html`
    <html lang="en">
      <head>
        <title>Album feed</title>
      </head>
      <body>
        <ul>
          ${items}
        </ul>
      </body>
    </html>
  `);
}
```

Interpolated strings are escaped, and nested `SafeHtml` fragments compose without being escaped a
second time. `html.raw` is only for markup the application already trusts; never pass user input to
it.

For normal pages, components provide composition, server rendering, and a path to browser
interactivity. The next chapter marks the smallest interactive components with `clientEntry(...)`
and hydrates them without replacing the server response path.
