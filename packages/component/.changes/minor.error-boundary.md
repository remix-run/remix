Render fallback content when part of the page fails to render with the new `<ErrorBoundary>` component. A boundary renders its `fallback` in place of children that throw during setup or render, and the rest of the page renders normally. See [error boundaries](https://github.com/remix-run/remix/tree/main/packages/component#error-boundaries) for what is caught on the server and in the browser.

```tsx
<ErrorBoundary
  fallback={(error, retry) => (
    <div role="alert">
      <p>Reviews failed to load.</p>
      <button type="button" mix={on('click', retry)}>
        Try again
      </button>
    </div>
  )}
>
  <Reviews bookId={book.id} />
</ErrorBoundary>
```

- **Server:** `renderToStream()` renders the fallback instead of rejecting when a child throws or a blocking `<Frame>` inside the boundary fails to resolve, and passes the error to `onError`. With `render()` middleware, the response keeps its status instead of failing the request. `renderToString()` logs caught errors with `console.error()` instead of rejecting.
- **Browser:** A boundary catches errors from its children's first render, hydration, parent updates, and `handle.update()` renders. It removes the failed content, disposes its components, logs the error, and renders the fallback. Caught errors are not dispatched as root `error` events. `retry()` renders the children again with new component instances.
- **Hydration:** The server does not send errors to the browser. A boundary whose server render failed hydrates its fallback without rendering its children, and the fallback receives a generic `Error`.

Boundaries render `<!-- rmx:eb -->` and `<!-- /rmx:eb -->` comments around their content, or `<!-- rmx:eb:error -->` when the server rendered the fallback, so the browser can find their content when hydrating.
