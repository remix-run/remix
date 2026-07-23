# SPA Demo

A small Vite app that uses Remix as a client-only router. It demonstrates a `URL -> RemixNode` contract configured through `RouterTypes.output` and rendered by the `SPA` component from `remix/ui`.

Navigation uses `router.fetch(url, { signal })`. The router turns the URL into an internal `Request`, so the same signal is available to handlers as `context.request.signal` and superseded page loads are cancelled.

POST form submissions are intercepted through the Navigation API. The listener forwards the event's `FormData` to `router.fetch(url, { method: 'POST', body, signal })`, where handlers can read it with `context.request.formData()`.

Navigation history entries do not retain submitted `FormData`. Back and forward navigations to a form destination therefore arrive as GET requests, so form destinations must accept both GET and POST. This demo declares `/greet` without a method restriction and only reads `request.formData()` for POST requests.

A submission to a new URL pushes a history entry. A submission to the active URL replaces the current entry using `NavigationPrecommitController` when available, with a programmatic replacement navigation as a fallback.

## Run It

```sh
pnpm -C demos/spa dev
```

Then open `http://localhost:44100`.
