---
title: Rendering UI
description: How Remix components produce HTML, stream frames, collect CSS, and compose first-party UI.
---

A route renders a Remix component tree into a Web `Response`. This chapter follows that path from a component's setup function through the shared document shell and server renderer.

## The Remix component model {#the-remix-component-model}

Remix components are not React components. Introduce the `Handle<Props>` setup phase, the zero-argument render function it returns, and the `RemixNode` values that render function may produce.

## Props, local state, context, and updates {#handle-props-setup-render-and-updates}

Cover current values in `handle.props`, setup-scope state, derived values in render, stable `handle.id` values, ancestor context, and explicit updates with `handle.update()`. DOM work and browser-only lifecycle belong in the interactivity chapter.

## Rendering pages through request context {#rendering-pages-through-request-context}

Add `render()` from `remix/middleware/render` to the router, then return `context.render(<Page />)` from actions. The middleware owns `renderToStream()`, frame resolution, client-entry resolution, and `createHtmlResponse()` so actions do not repeat request-specific setup. Pass `render({ assets })` so source-based `clientEntry()` modules resolve to browser URLs, and reserve `renderWith()` for custom rendering pipelines.

## Server rendering with renderToStream and renderToString {#server-rendering-with-rendertostream-and-rendertostring}

Compare the streaming `ReadableStream<Uint8Array>` returned by `renderToStream()` with the buffered string returned by `renderToString()`. Pass `request.signal` to streaming renders and use `onError` for reporting unexpected rendering failures.

## Blocking and streaming frames {#streaming-and-deferred-rendering}

Explain the two server-rendering modes for `<Frame>`: a frame without `fallback` blocks the initial chunk, while a frame with `fallback` sends that fallback and streams its resolved HTML later. Client-side frame loading and reloads stay in the interactivity chapter.

## Document shells, head content, and HTML responses {#document-shells-and-head-content}

Build the complete `<html>`, `<head>`, and `<body>` tree explicitly in a shared document component. Head elements are not hoisted automatically. Show where asset links, module preloads, and the browser entry script enter the shell, and use `createHtmlResponse()` to set the HTML content type and doctype.

## Styling with css and dynamic style values {#styling-with-css}

Use `css(...)` for static rules, selectors, media queries, and keyframes; use the `style` prop for values that change frequently. Server rendering collects `css(...)` output into the document rather than injecting each component's styles separately in the browser.

## Cascade layers and app-owned design tokens {#theme-tokens-and-cascade-layers}

Remix-generated rules live in the `rmx` cascade layer. Explain how an app orders reset, Remix, theme, and override layers, while keeping colors, spacing scales, and other design tokens in app-owned CSS or TypeScript rather than implying Remix supplies a theme system.

## First-party UI building blocks {#first-party-ui-components}

Introduce the first-party subpaths by the amount of markup and behavior they own. The individual package READMEs remain the API reference.

### Style mixins for native controls {#style-mixins-keep-native-controls-native}

`remix/ui/button`, `input`, `checkbox`, `radio`, and `toggle` style native controls and preserve their form behavior. Compose them with app-owned layout and state styles through `mix`.

### Composed controls for common interactions {#composed-components-cover-common-product-ui}

Accordion, breadcrumbs, combobox, menu, select, and tabs provide ready-made markup and behavior. Cover controlled and uncontrolled values, bubbling change events, disabled states, keyboard behavior, and hidden inputs for form participation where the component supports them.

### Headless primitives for custom markup {#primitives-keep-behavior-reusable-when-markup-changes}

Use popover, listbox, anchor, and the `/primitives` exports for accordion, combobox, menu, select, tabs, and toggle when the app must own markup or styling. Preserve native semantics, focus behavior, and accessible names when composing lower-level pieces.

## Rendering HTML without the component runtime {#rendering-html-without-the-component-runtime}

Use `remix/html-template` for escaped HTML strings such as feeds, email bodies, or small non-component responses. Compose `SafeHtml` fragments, and reserve `html.raw` for content the app already trusts.
