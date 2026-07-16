---
title: Advanced Guides
description: Specialized patterns built from Remix's lower-level UI, proxy, stream, template, storage, and archive APIs.
---

These guides start after the main app path already works. Each one combines a focused Remix package with Web APIs for a specialized requirement rather than introducing another application architecture.

## Build custom host behavior with createMixin {#building-reusable-mixin-libraries}

Use `createMixin()` when several components share element-level setup, teardown, queued work, or a semantic custom event. Cover pure prop transforms, insert/remove lifecycle, namespaced events, and `HTMLElementEventMap` typing.

## Build custom UI primitives {#building-custom-ui-primitives}

Compose context providers, controlled state, bubbling custom events, host mixins, and app-owned styles into a reusable primitive. Use the first-party popover, listbox, anchor, and `/primitives` exports before recreating their focus, keyboard, and accessibility behavior.

## Render custom value types through middleware {#custom-renderers}

Use `renderWith()` to install request-scoped renderers for Remix nodes, `SafeHtml`, JSON, feeds, or email previews. Keep status, headers, frame resolution, and request-specific asset URLs in the renderer rather than in route-local helpers.

## Proxy HTTP requests with Fetch {#fetch-proxying}

Use `createFetchProxy()` to forward a request to another origin, optionally add trusted forwarded headers, supply a custom `fetch`, and rewrite upstream cookie domain or path attributes. Validate the destination instead of turning user input into an open proxy.

## Stream server-sent events {#server-sent-events}

Return a `ReadableStream` with `text/event-stream`, format event and data lines, stop timers when `request.signal` aborts, and account for proxy buffering and compression flushes. In a client entry, own `EventSource` with `handle.signal` and render connection state explicitly.

## Generate safe HTML without Remix UI {#safe-html-templates}

Use `remix/html-template` and `createHtmlResponse()` for small string-rendered documents. Escaped interpolation, composable `SafeHtml`, and narrowly trusted `html.raw` fragments are enough for feeds, email, and low-JavaScript utilities such as the UNPKG demo.

## Parse tar archives and build package browsers {#tar-parsing-and-package-browser-style-apps}

Pipe fetched archive bytes through decompression and `parseTar()`, process entries incrementally, and cache results behind `FileStorage`. Combine catch-all routes, MIME detection, safe HTML rendering, and bounded external fetches without buffering archives unnecessarily.

## Extend low-level protocol support deliberately {#integrating-external-services}

Custom auth schemes, OIDC providers, MIME registrations, multipart processing, and raw SQL are escape hatches documented with their owning packages. Reach for them only after the higher-level middleware, provider, parser, or query API cannot represent the integration.
