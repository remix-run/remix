---
title: Rendering UI
description: How Remix components render on the server, collect styles, and form the document shell.
---

## The Remix component model {#the-remix-component-model}

A Remix UI component is a function that receives a `Handle` and returns a render function. The component function runs once for an instance. The returned render function runs for the initial render and every update after that.

```tsx filename=app/ui/counter.tsx
import { css, on } from "remix/ui";
import type { Handle } from "remix/ui";

export function Counter(
  handle: Handle<{ initialCount?: number; label: string }>,
) {
  let count = handle.props.initialCount ?? 0;

  return () => (
    <button
      mix={[
        counterStyle,
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
}

const counterStyle = css({
  border: "1px solid #d6d6d6",
  borderRadius: "999px",
  background: "white",
  cursor: "pointer",
  font: "inherit",
  padding: "0.7rem 1rem",
});
```

The setup scope is normal JavaScript. Use it for local state, one-time initialization, subscriptions, and values that should live as long as that component instance lives. Read `handle.props` in the render function when the value should follow parent updates.

::frame{src="/docs/examples/04-rendering-ui/component-model"}

## Handle, props, setup, render, and updates {#handle-props-setup-render-and-updates}

`handle` is the component's interface to the runtime. It exposes `props`, `update()`, `queueTask()`, `signal`, `id`, `context`, and frame handles.

The important split is setup versus render:

| Scope                | Runs                            | Use it for                                                          |
| -------------------- | ------------------------------- | ------------------------------------------------------------------- |
| Component function   | Once per instance               | Local variables, event helpers, subscriptions, derived IDs          |
| Render function      | Initial render and every update | JSX that reads current props and local state                        |
| `handle.queueTask()` | After the next render flush     | DOM work such as focus, scroll, measurement, or reactive async work |

Use `handle.update()` after changing state that affects rendered output. Await it when the next line needs the updated DOM.

```tsx filename=app/ui/player.tsx
import { on, ref } from "remix/ui";
import type { Handle } from "remix/ui";

export function Player(handle: Handle) {
  let isPlaying = false;
  let playButton: HTMLButtonElement;
  let stopButton: HTMLButtonElement;

  return () => (
    <div>
      <button
        disabled={isPlaying}
        mix={[
          ref((node) => (playButton = node)),
          on("click", async () => {
            isPlaying = true;
            await handle.update();
            stopButton.focus();
          }),
        ]}
        type="button"
      >
        Play
      </button>
      <button
        disabled={!isPlaying}
        mix={[
          ref((node) => (stopButton = node)),
          on("click", async () => {
            isPlaying = false;
            await handle.update();
            playButton.focus();
          }),
        ]}
        type="button"
      >
        Stop
      </button>
    </div>
  );
}
```

`await handle.update()` resolves after Remix patches the DOM. `ref(...)` keeps the button references in the component setup scope, and the focus code can run without storing extra render state.

## Server rendering with renderToStream and renderToString {#server-rendering-with-rendertostream-and-rendertostring}

Remix UI renders to Web streams on the server. `renderToStream()` is the default for HTTP responses because the browser can start receiving HTML before the whole tree is complete. `renderToString()` is useful for tests, emails, static snippets, and any integration that needs the complete HTML string.

```tsx filename=app/middleware/render.tsx
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import type { RemixNode } from "remix/ui";
import { renderToStream } from "remix/ui/server";

export function render() {
  return renderWith(
    ({ request }) =>
      function render(node: RemixNode, init?: ResponseInit) {
        let stream = renderToStream(node, {
          frameSrc: request.url,
          signal: request.signal,
          onError(error) {
            console.error(error);
          },
        });

        return createHtmlResponse(stream, init);
      },
  );
}
```

The middleware adapts Remix UI to the app's request context once. Route controllers can then return `context.render(<Page />)` instead of repeating streaming setup in every action.

Use `renderToString()` when you need the final markup rather than a response body stream:

```tsx filename=app/email/render.tsx
import type { RemixNode } from "remix/ui";
import { renderToString } from "remix/ui/server";

export async function renderEmail(node: RemixNode) {
  return await renderToString(node);
}
```

## Document shells and head content {#document-shells-and-head-content}

Render document structure explicitly. A layout component can own `<html>`, `<head>`, global assets, and the app body while controllers stay focused on route data.

```tsx filename=app/ui/document.tsx
import type { Handle, RemixNode } from "remix/ui";

export function Document(
  handle: Handle<{ children: RemixNode; title: string }>,
) {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{handle.props.title}</title>
        <script async type="module" src="/assets/app/entry.ts" />
      </head>
      <body>{handle.props.children}</body>
    </html>
  );
}
```

Keep head content near the layout that owns it. Remix UI does not hoist random `title`, `meta`, `link`, or `script` elements from deep children into the document head, so ordering stays visible in the component tree.

## Styling with css {#styling-with-css}

Use the `css(...)` mixin for static styles, nested selectors, pseudo-selectors, pseudo-elements, and media queries. Use the `style` prop for values that change frequently at runtime.

```tsx filename=app/ui/product-card.tsx
import { css } from "remix/ui";
import type { Handle } from "remix/ui";

export function ProductCard(handle: Handle<{ title: string; price: number }>) {
  return () => (
    <article mix={cardStyle}>
      <h3 class="title" mix={titleStyle}>
        {handle.props.title}
      </h3>
      <p mix={priceStyle}>${handle.props.price}</p>
      <button mix={buttonStyle} type="button">
        Add to cart
      </button>
    </article>
  );
}

const cardStyle = css({
  border: "1px solid #d6d6d6",
  borderRadius: "16px",
  padding: "1rem",
  transition: "transform 180ms ease, box-shadow 180ms ease",
  "&:hover": {
    boxShadow: "0 12px 32px rgba(15, 17, 21, 0.14)",
    transform: "translateY(-3px)",
    "& .title": {
      color: "#d83a5a",
    },
    "& button": {
      backgroundColor: "#b8324d",
    },
  },
});

const titleStyle = css({
  margin: 0,
  transition: "color 180ms ease",
});

const priceStyle = css({
  fontWeight: "700",
});

const buttonStyle = css({
  border: 0,
  borderRadius: "999px",
  backgroundColor: "#d83a5a",
  color: "white",
  padding: "0.7rem 1rem",
});
```

Nested selectors are a good fit when parent state affects children. Do not move hover, focus, or selected styling into JavaScript state unless rendering needs to know about that state too.

::frame{src="/docs/examples/04-rendering-ui/styling-card"}

## Theme tokens and cascade layers {#theme-tokens-and-cascade-layers}

The UI runtime emits generated `css(...)` rules in the `rmx` cascade layer and its reset in `rmx-reset`. Put app base layers before those layers when they should lose to Remix UI, and put app override layers after `rmx` when they should win.

```css filename=app/styles/theme.css
@layer base, rmx-reset, rmx, app;

:root {
  --surface: white;
  --surface-muted: #f8fafc;
  --text: #151515;
  --accent: #1a72ff;
}

@layer base {
  button,
  input,
  select,
  textarea {
    font: inherit;
  }
}

@layer app {
  .marketing-heading {
    color: var(--accent);
  }
}
```

Treat theme tokens as app-owned CSS custom properties or context values. They work across server rendering, frames, hydrated client entries, and plain CSS files.

```tsx filename=app/ui/theme.tsx
import { css } from "remix/ui";
import type { Handle, RemixNode } from "remix/ui";

export function ThemeProvider(handle: Handle<{ children: RemixNode }>) {
  return () => <div mix={themeStyle}>{handle.props.children}</div>;
}

const themeStyle = css({
  color: "var(--text)",
  background: "var(--surface)",
});
```

## First-party UI components

Remix UI ships three layers so apps can stop at the highest level that fits the design.

| Layer               | Use it when                                            | Examples                                                                            |
| ------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Style mixins        | Native HTML already has the right semantics            | `button`, `input`, `checkbox`, `radio`, `toggle`                                    |
| Composed controls   | The default markup and styling fit                     | `Accordion`, `Menu`, `Select`, `Combobox`, `Tabs`, `Breadcrumbs`                    |
| Headless primitives | The app owns trigger, surface, option, or panel markup | `popover`, `listbox`, `menu/primitives`, `select/primitives`, `combobox/primitives` |

These guide frames mirror the UI package demos but stay narrative-sized for docs.

### Style mixins keep native controls native {#style-mixins-keep-native-controls-native}

Button and form-control mixins own visuals and default host attributes only. The app still chooses the native element, name/value fields, labels, disabled state, and local layout.

::frame{src="/docs/examples/04-rendering-ui/button-basic"}

::frame{src="/docs/examples/04-rendering-ui/button-component"}

::frame{src="/docs/examples/04-rendering-ui/button-states"}

::frame{src="/docs/examples/04-rendering-ui/input-basic"}

::frame{src="/docs/examples/04-rendering-ui/checkbox-basic"}

::frame{src="/docs/examples/04-rendering-ui/radio-basic"}

::frame{src="/docs/examples/04-rendering-ui/toggle-basic"}

### Composed components cover common product UI {#composed-components-cover-common-product-ui}

Composed components wire accessible structure, keyboard behavior, styles, and event contracts for common controls. Use them when their markup matches the product design.

::frame{src="/docs/examples/04-rendering-ui/breadcrumbs-basic"}

::frame{src="/docs/examples/04-rendering-ui/breadcrumbs-separator"}

::frame{src="/docs/examples/04-rendering-ui/accordion-overview"}

::frame{src="/docs/examples/04-rendering-ui/accordion-multiple"}

::frame{src="/docs/examples/04-rendering-ui/accordion-card"}

::frame{src="/docs/examples/04-rendering-ui/tabs-basic"}

::frame{src="/docs/examples/04-rendering-ui/menu-overview"}

::frame{src="/docs/examples/04-rendering-ui/menu-bubbling"}

::frame{src="/docs/examples/04-rendering-ui/menu-context-trigger"}

::frame{src="/docs/examples/04-rendering-ui/select-overview"}

::frame{src="/docs/examples/04-rendering-ui/combobox-overview"}

### Primitives keep behavior reusable when markup changes {#primitives-keep-behavior-reusable-when-markup-changes}

Headless primitives expose the same behavior under lower-level mixins. Reach for them when the trigger, surface, option list, or panel layout needs app-owned markup.

::frame{src="/docs/examples/04-rendering-ui/anchor-positioning"}

::frame{src="/docs/examples/04-rendering-ui/popover-basic"}

::frame{src="/docs/examples/04-rendering-ui/listbox-primitives"}

::frame{src="/docs/examples/04-rendering-ui/accordion-primitives"}

::frame{src="/docs/examples/04-rendering-ui/menu-primitives"}

::frame{src="/docs/examples/04-rendering-ui/select-deconstructed"}

::frame{src="/docs/examples/04-rendering-ui/combobox-primitives"}
