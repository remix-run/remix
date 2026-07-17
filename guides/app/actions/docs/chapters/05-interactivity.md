---
title: Interactivity
description: How server-rendered UI hydrates in the browser, handles events, navigates, reloads frames, and cancels stale work.
---

Start with a route that already returns useful HTML. Browser code should enhance that response rather than replace the route's links, forms, validation, redirects, and error responses.

## Progressive enhancement {#progressive-enhancement}

Use real anchors and forms for the baseline path. Add browser behavior only when it improves the interaction, and keep the same controller action responsible for the underlying mutation or page response.

## Hydration boundaries with clientEntry {#cliententry}

Mark the smallest interactive component with `clientEntry(import.meta.url, Component)`. Explain how the server renders entry markers, how the renderer resolves source module URLs through the asset server, and why entry props must be serializable.

## Booting the browser runtime with run {#browser-entry-with-run}

Use `run()` in the app's browser entry to load named component exports and resolve client-loaded frames. Cover `app.ready()`, `app.flush()`, and `app.dispose()` without presenting a browser entry as a second application router.

## Mount client-only UI with createRoot {#client-only-roots}

Use `createRoot(container)` for UI that has no server-rendered counterpart, or for an app-level fallback after disposing a failed runtime. Its `render`, `flush`, and `dispose` methods own that container; normal page interactivity should still begin with a server-rendered `clientEntry`.

## State, updates, and post-render tasks {#state-updates-and-post-render-tasks}

Keep component state in setup scope, call `handle.update()` after changes, and await it when follow-up work needs the updated DOM. Use `handle.queueTask()` for work after commit and for work keyed to changing props.

## Events with on {#events-with-on}

Attach typed DOM events with `on(...)`. Prefer native elements so click, keyboard, focus, and form semantics come from the platform, then intercept an event only when the enhanced path needs to prevent the browser default.

## Composing behavior with mix {#the-mix-prop}

Use one mixin directly or an array to compose `on`, `ref`, `attrs`, `link`, `css`, and animation mixins on a host element. Keep static behavior in mixins and rapidly changing presentation values in ordinary props such as `style`.

## DOM references, global events, and cleanup {#refs-attrs-and-dom-lifecycle}

Use `ref(...)` when setup needs a mounted element, and `addEventListeners(target, handle.signal, listeners)` for window, document, media-query, or other `EventTarget` listeners. Teardown should follow the signal owned by the element, task, or component that created the work.

## Async work and cancellation {#optimistic-updates-and-cancellation-with-handle-signal}

Distinguish the three cancellation scopes: an `on(...)` handler signal aborts when that handler is re-entered or removed, a queued-task signal aborts on the next render or removal, and `handle.signal` aborts when the component disconnects. Pass the narrowest signal to `fetch()` and check it before committing results.

## Client navigation {#client-navigation}

Use normal anchors for document navigation. Use `navigate(...)` or the `link(...)` mixin for Navigation API transitions, and explain `target`, `history`, `resetScroll`, `rmx-target`, `rmx-src`, and `rmx-document` only where a frame-aware navigation needs them.

## Frames and partial server-rendered UI {#frames-and-partial-server-rendered-ui}

Show blocking and fallback frames, nested frames, and named frames. In the browser, `handle.frame.reload()`, `handle.frames.get(name)`, and `handle.frames.top.reload()` fetch server-rendered HTML while preserving matching client-entry state.

## Enhancing forms with fetch and frame reloads {#coordinating-forms-fetches-frame-reloads-and-navigation}

Intercept a form submission with `on('submit', ...)`, send the same `FormData` to the form action, and reload the frame that owns the server-rendered result. Use a small JSON endpoint or polling only when a frame would be heavier than the state being synchronized.

## Pending and optimistic UI {#optimistic-ui}

Pending labels, disabled controls, optimistic values, rollback, and conflict handling are component patterns rather than a separate Remix data API. Derive optimistic state from the attempted mutation, keep the server response authoritative, and let handler cancellation prevent stale responses from winning.

## Creating custom mixins {#creating-custom-mixins}

Most app code should stop at the built-in mixins. The advanced guide covers `createMixin()` lifecycle hooks and custom semantic events when the same host behavior must be shared across components.
