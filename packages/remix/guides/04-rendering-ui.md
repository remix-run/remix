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
import type { Handle } from "remix/ui";

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
import type { Handle } from "remix/ui";

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

```tsx
import { css, on } from "remix/ui";
import type { Handle } from "remix/ui";

export function ComponentModelDemo() {
  return () => (
    <div mix={counterDemoStyles}>
      <Counter initialCount={2} label="Inbox" />
      <Counter initialCount={8} label="Deploys" />
    </div>
  );
}

function Counter(handle: Handle<{ initialCount: number; label: string }>) {
  let count = handle.props.initialCount;

  return () => (
    <button
      mix={[
        counterStyles,
        on("click", () => {
          count++;
          handle.update();
        }),
      ]}
      type="button"
    >
      <span mix={counterValueStyles}>{count}</span>
      <span>{handle.props.label}</span>
    </button>
  );
}

const counterDemoStyles = css({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "0.75rem",
});

const counterStyles = css({
  display: "grid",
  minWidth: "9rem",
  gap: "0.35rem",
  padding: "1rem",
  border: "1px solid #d6d6d6",
  borderRadius: "16px",
  background: "white",
  color: "#151515",
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
  boxShadow: "0 8px 24px rgba(15, 17, 21, 0.08)",
  "&:hover": {
    boxShadow: "0 12px 32px rgba(15, 17, 21, 0.12)",
    transform: "translateY(-2px)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
});

const counterValueStyles = css({
  color: "#d83a5a",
  fontSize: "2.75rem",
  fontWeight: "900",
  lineHeight: "0.9",
  letterSpacing: "-0.08em",
});
```

## Props, local state, context, and updates {#handle-props-setup-render-and-updates}

Every component receives a `Handle`. `handle.props` is a stable object whose property values are
replaced before each render, so callbacks and render output should read current values from it.
Destructuring the object is safe. Destructuring one of its properties in setup captures only the
initial value.

```tsx
import type { Handle } from "remix/ui";

function AlbumTitle(handle: Handle<{ title: string }>) {
  let { props } = handle;
  let initialTitle = props.title;

  return () => <h1 title={`Originally ${initialTitle}`}>{props.title}</h1>;
}
```

Local state is ordinary JavaScript declared in setup scope. Store values that affect rendering and
derive everything else inside render:

```tsx filename=app/ui/album-list.tsx
import { on } from "remix/ui";
import type { Handle } from "remix/ui";

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
import type { Handle } from "remix/ui";

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
import type { Handle, RemixNode } from "remix/ui";

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
import type { Handle, RemixNode } from "remix/ui";
import { ImportMap } from "remix/ui/server";

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
import { css } from "remix/ui";
import type { Handle } from "remix/ui";

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

```tsx
import { css } from "remix/ui";
import type { Handle } from "remix/ui";

export function StylingCardDemo() {
  return () => (
    <ProductCard
      title="Noise-canceling headphones"
      price={199}
      description="Hover the card to let nested CSS selectors update the title and button."
    />
  );
}

function ProductCard(handle: Handle<{ description: string; price: number; title: string }>) {
  return () => (
    <article mix={productCardStyles}>
      <div mix={productImageStyles} aria-hidden="true">
        <svg viewBox="0 0 120 80" fill="none">
          <path
            d="M30 43c0-18 12-31 30-31s30 13 30 31"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="8"
          />
          <rect width="24" height="34" x="18" y="38" fill="currentColor" rx="12" />
          <rect width="24" height="34" x="78" y="38" fill="currentColor" rx="12" />
        </svg>
      </div>
      <div mix={productBodyStyles}>
        <h4 class="title" mix={productTitleStyles}>
          {handle.props.title}
        </h4>
        <p mix={productDescriptionStyles}>{handle.props.description}</p>
        <div mix={productFooterStyles}>
          <span mix={productPriceStyles}>${handle.props.price}</span>
          <button mix={productButtonStyles} type="button">
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
}

const productCardStyles = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 10rem) minmax(0, 1fr)",
  maxWidth: "34rem",
  overflow: "hidden",
  border: "1px solid #d6d6d6",
  borderRadius: "18px",
  background: "white",
  boxShadow: "0 12px 32px rgba(15, 17, 21, 0.08)",
  transition: "transform 180ms ease, box-shadow 180ms ease",
  "&:hover": {
    boxShadow: "0 18px 44px rgba(15, 17, 21, 0.14)",
    transform: "translateY(-3px)",
    "& .title": {
      color: "#d83a5a",
    },
    "& button": {
      backgroundColor: "#b8324d",
    },
  },
  "@media (max-width: 560px)": {
    gridTemplateColumns: "1fr",
  },
});

const productImageStyles = css({
  display: "grid",
  placeItems: "center",
  minHeight: "12rem",
  background: "linear-gradient(135deg, #ffe5eb, #f8fafc)",
  color: "#d83a5a",
  "& svg": {
    width: "7rem",
    height: "auto",
  },
});

const productBodyStyles = css({
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "1rem",
});

const productTitleStyles = css({
  margin: 0,
  fontSize: "1.15rem",
  fontWeight: "800",
  letterSpacing: "-0.03em",
  transition: "color 180ms ease",
});

const productDescriptionStyles = css({
  margin: 0,
  color: "#4f4f4f",
  lineHeight: "1.6",
});

const productFooterStyles = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  marginTop: "auto",
});

const productPriceStyles = css({
  fontSize: "1.5rem",
  fontWeight: "900",
  letterSpacing: "-0.06em",
});

const productButtonStyles = css({
  border: "1px solid #d83a5a",
  borderRadius: "999px",
  background: "#d83a5a",
  color: "white",
  cursor: "pointer",
  font: "inherit",
  fontWeight: "700",
  padding: "0.7rem 1rem",
  transition: "background-color 180ms ease, transform 120ms ease",
  "&:active": {
    transform: "scale(0.98)",
  },
});
```

## Cascade layers and app-owned design tokens {#theme-tokens-and-cascade-layers}

Generated `css(...)` rules, including styles from first-party UI components, live in the native
`rmx` cascade layer. If your app uses its own layers, declare the complete order once:

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

Layers before `rmx` provide defaults that Remix component styles can override. Layers after `rmx`
can override component styles deliberately. Unlayered author CSS outranks normal layered CSS, so use
it intentionally when the rest of the app has an explicit layer order.

Remix supplies behavior and a small set of component styles, not an application theme. Keep brand
colors, spacing, typography, radii, and other design tokens in app-owned CSS custom properties or
TypeScript values.

## First-party UI building blocks {#first-party-ui-components}

The `remix/ui/*` subpaths cover three levels of ownership. Start with the highest-level API whose
markup fits the product, then move down only when the app needs control the composed component does
not expose.

These APIs all render on the server. Controls that handle browser events must also be inside a
`clientEntry(...)` boundary, either directly or through an interactive ancestor. The next chapter
shows how to choose that boundary.

| Level               | Subpaths                                                                 | What the app owns                                            |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Style mixins        | `button`, `input`, `checkbox`, `radio`, `toggle`                         | The native control, its label, layout, and state.            |
| Composed controls   | `accordion`, `breadcrumbs`, `combobox`, `menu`, `select`, `tabs`         | The surrounding page and the values passed into the control. |
| Headless primitives | `popover`, `listbox`, `anchor`, and each available `/primitives` subpath | Markup and styling while Remix supplies focused behavior.    |

The [`remix/ui` API overview](../src/ui/README.md) links to the complete API
for every subpath. The sections below show how to choose among them.

### Style mixins for native controls {#style-mixins-keep-native-controls-native}

Style mixins keep native form behavior in the element you render:

```tsx filename=app/ui/album-actions.tsx
import button from "remix/ui/button";
import checkbox from "remix/ui/checkbox";
import { css } from "remix/ui";

const actionRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
});

export function AlbumActions() {
  return () => (
    <div mix={actionRowStyle}>
      <button mix={button({ tone: "primary" })}>Add to cart</button>
      <label>
        <input mix={checkbox()} name="gift" type="checkbox" />
        This is a gift
      </label>
    </div>
  );
}
```

The checkbox remains a checkbox, participates in `FormData`, and gets its keyboard behavior from the
browser. The mixin supplies visuals. Compose an array in `mix` when a host also needs app-owned styles
or behavior.

```tsx
import { css } from "remix/ui";
import button from "remix/ui/button";

/**
 * @name Button Basic
 * @description The button mixin applies neutral, primary, or ghost pill styling to button-like hosts.
 * @layout center
 */
export function ButtonBasic() {
  return () => (
    <div mix={buttonDemoCss}>
      <section mix={toneSectionCss}>
        <h2 mix={toneLabelCss}>Neutral</h2>
        <div mix={buttonRowCss}>
          <button mix={button()}>Medium</button>
          <button mix={button({ size: "lg" })}>Large</button>
          <button aria-pressed="true" mix={button()}>
            Pressed
          </button>
          <button disabled mix={button()}>
            Disabled
          </button>
        </div>
      </section>

      <section mix={toneSectionCss}>
        <h2 mix={toneLabelCss}>Primary</h2>
        <div mix={buttonRowCss}>
          <button mix={button({ tone: "primary" })}>Medium</button>
          <button mix={button({ size: "lg", tone: "primary" })}>Large</button>
          <button aria-pressed="true" mix={button({ tone: "primary" })}>
            Pressed
          </button>
          <button disabled mix={button({ tone: "primary" })}>
            Disabled
          </button>
        </div>
      </section>

      <section mix={toneSectionCss}>
        <h2 mix={toneLabelCss}>Ghost</h2>
        <div mix={buttonRowCss}>
          <button mix={button({ tone: "ghost" })}>Medium</button>
          <button mix={button({ size: "lg", tone: "ghost" })}>Large</button>
          <button aria-pressed="true" mix={button({ tone: "ghost" })}>
            Pressed
          </button>
          <button disabled mix={button({ tone: "ghost" })}>
            Disabled
          </button>
        </div>
      </section>
    </div>
  );
}

const buttonDemoCss = css({
  display: "grid",
  gap: "22px",
  width: "min(100%, 34rem)",
});

const toneSectionCss = css({
  display: "grid",
  gap: "8px",
});

const toneLabelCss = css({
  margin: 0,
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: "11px",
  lineHeight: "14px",
  fontWeight: 600,
  letterSpacing: 0,
  color: "rgba(16, 16, 16, 0.58)",
});

const buttonRowCss = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px",
});
```

### Composed controls for common interactions {#composed-components-cover-common-product-ui}

Composed controls own the relationships among several elements. For example, `Accordion` connects
triggers to content regions and manages disclosure state:

```tsx filename=app/ui/shipping-details.tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "remix/ui/accordion";

export function ShippingDetails() {
  return () => (
    <Accordion defaultValue="returns">
      <AccordionItem value="delivery">
        <AccordionTrigger>Delivery</AccordionTrigger>
        <AccordionContent>Ships in two business days.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="returns">
        <AccordionTrigger>Returns</AccordionTrigger>
        <AccordionContent>Return unopened albums within 30 days.</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

Use a `default*` prop when the control should own its initial state. Use the corresponding controlled
prop and change callback when the parent must own that state. The exact names differ by component:
for example, accordion uses `defaultValue`/`value`, while tabs uses
`defaultActiveTab`/`activeTab`.

Selection and disclosure events bubble where a component's API documents them, so a parent can
observe changes without threading a callback through every item. Controls that accept `name`, such
as `Select` and `Combobox`, render a hidden input so the selected value participates in a normal form.
Disabled state, accessible names, focus movement, and keyboard behavior remain part of each
component's contract.

```tsx
import { css } from "remix/ui";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "remix/ui/accordion";

/**
 * @name Accordion Overview
 * @description A single-open disclosure list that keeps settings, billing, or notification rules in one calm section.
 * @layout center
 * @order 1
 */
export function AccordionOverview() {
  return () => (
    <Accordion defaultValue="account">
      <AccordionItem value="account">
        <AccordionTrigger>Account defaults</AccordionTrigger>
        <AccordionContent>
          <p mix={bodyTextCss}>
            Keep billing contacts, email summaries, and workspace naming rules in one calm
            disclosure list without adding another card layer.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="billing">
        <AccordionTrigger>Billing schedule</AccordionTrigger>
        <AccordionContent>
          <p mix={bodyTextCss}>
            Review invoice timing, payment methods, and renewal reminders with the same spacing and
            typography used elsewhere in the system.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="notifications">
        <AccordionTrigger>Notification rules</AccordionTrigger>
        <AccordionContent>
          <p mix={bodyTextCss}>
            Use single mode when only one details panel should stay open at a time in a compact
            settings or details view.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

const bodyTextCss = css({
  margin: 0,
  fontSize: "13px",
  lineHeight: "1.65",
  color: "#4f4f4f",
});
```

```tsx
import { css } from "remix/ui";
import { Option, Select } from "remix/ui/select";

/**
 * @name Select Overview
 * @description A styled select control with a searchable dropdown and accessible label.
 * @layout center
 */
export function SelectOverview() {
  return () => (
    <div mix={stackCss}>
      <label for="fruit-select" mix={labelCss}>
        Choose a fruit
      </label>
      <Select
        id="fruit-select"
        defaultLabel="Banana"
        defaultValue="banana"
        name="fruit"
        mix={selectCss}
      >
        <Option label="Apple" value="apple" />
        <Option label="Apricot" value="apricot" />
        <Option label="Banana" value="banana" />
        <Option label="Blackberry" value="blackberry" />
        <Option label="Blackcurrant" value="blackcurrant" />
        <Option label="Blueberry" value="blueberry" />
        <Option label="Boysenberry" value="boysenberry" />
        <Option label="Cantaloupe" value="cantaloupe" />
      </Select>
    </div>
  );
}

const selectCss = css({
  width: "16rem",
});

const stackCss = css({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  width: "100%",
});

const labelCss = css({
  margin: 0,
  fontSize: "12px",
  fontWeight: "600",
  color: "#151515",
});
```

### Headless primitives for custom markup {#primitives-keep-behavior-reusable-when-markup-changes}

Reach for primitives when the product requires different markup, not merely different colors or
spacing. `popover` supplies anchored-surface behavior, `listbox` supplies option highlighting and
selection, and `anchor` handles lower-level floating-element placement. Accordion, combobox, menu,
select, tabs, and toggle also expose `/primitives` subpaths.

The primitives are smaller, but the app takes on more responsibility. Preserve native elements when
they fit, keep labels and ARIA relationships intact, and test pointer and keyboard behavior. A custom
select, for example, still needs a provider, trigger, popover, list, options, and hidden input if it
participates in a form.

```tsx
import { css } from "remix/ui";
import * as accordion from "remix/ui/accordion/primitives";

/**
 * @name Accordion Primitives
 * @description Headless accordion behavior with minimal local styles.
 * @layout center
 */
export function AccordionPrimitives() {
  return () => (
    <accordion.Context defaultValue="shipping">
      <div mix={[rootCss, accordion.root()]}>
        <accordion.ItemContext value="shipping">
          <div mix={[itemCss, accordion.item()]}>
            <h3 mix={headingCss}>
              <button mix={[triggerCss, accordion.trigger()]} type="button">
                Shipping
              </button>
            </h3>
            <div mix={[contentCss, accordion.content()]}>
              Default carrier, cutoff time, and delivery windows.
            </div>
          </div>
        </accordion.ItemContext>

        <accordion.ItemContext value="billing">
          <div mix={[itemCss, accordion.item()]}>
            <h3 mix={headingCss}>
              <button mix={[triggerCss, accordion.trigger()]} type="button">
                Billing
              </button>
            </h3>
            <div mix={[contentCss, accordion.content()]}>
              Invoice cadence, billing contact, and tax settings.
            </div>
          </div>
        </accordion.ItemContext>

        <accordion.ItemContext disabled value="archived">
          <div mix={[itemCss, accordion.item()]}>
            <h3 mix={headingCss}>
              <button mix={[triggerCss, accordion.trigger()]} type="button">
                Archived
              </button>
            </h3>
            <div mix={[contentCss, accordion.content()]}>Unavailable settings.</div>
          </div>
        </accordion.ItemContext>
      </div>
    </accordion.Context>
  );
}

const rootCss = css({
  display: "grid",
  width: "24rem",
  maxWidth: "100%",
  border: "1px solid #d8d8d8",
  borderRadius: "8px",
  background: "#ffffff",
});

const itemCss = css({
  borderBlockStart: "1px solid #e8e8e8",
  "&:first-child": {
    borderBlockStart: 0,
  },
  "&[data-disabled]": {
    opacity: 0.45,
  },
});

const headingCss = css({
  margin: 0,
});

const triggerCss = css({
  appearance: "none",
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
  border: 0,
  background: "transparent",
  color: "#101010",
  font: '600 13px/18px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: "10px 12px",
  textAlign: "left",
  "&::after": {
    content: '"+"',
  },
  '&[data-state="open"]::after': {
    content: '"-"',
  },
  "&:focus-visible": {
    outline: "2px solid #3573f6",
    outlineOffset: "-2px",
  },
});

const contentCss = css({
  color: "#4f4f4f",
  font: '500 13px/20px "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  letterSpacing: 0,
  padding: "0 12px 12px",
  '&[data-state="closed"]': {
    display: "none",
  },
});
```

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
