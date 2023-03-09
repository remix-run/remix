---
title: ErrorBoundary (v2)
---

# `ErrorBoundary (v2)`

<docs-info>You can opt into the Remix v2 `ErrorBoundary` behavior via the `future.v2_errorBoundary` flag in your `remix.config.js`</docs-info>

If you export an `ErrorBoundary` component from your route module, it will be used as the React Router [`errorElement`][rr-error-element] and will render if you throw from a loader/action or if React throws during rendering your Route component.

[rr-error-element]: https://reactrouter.com/route/error-element
