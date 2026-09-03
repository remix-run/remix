# Lazy Frames Demo

This demo renders a long page without fetching every section up front. Its first study sends one checked-in HTML/CSS motion artifact through a regular server-rendered `Frame` and the same route through `LazyFrame`. The remaining sections use the same lazy client component: it server-renders a placeholder, observes its stable host, then mounts a Remix `Frame` when the host enters a 320 px vertical viewport margin. Requested Frames stay mounted when they leave the viewport, so scrolling back never triggers another round trip.

## Run It

```sh
cd demos/lazy-frames
pnpm install
pnpm start
```

Visit [http://localhost:44100](http://localhost:44100) and scroll through the page. Use the browser network panel to see frame requests begin only as their sections approach. The fixed controls can switch the entire document between light and dark themes without refetching Frames, or enable a cookie-backed 520 ms delay on every router request, including pages, frames, and browser modules.

For server restarts while editing, run `pnpm dev`.

## One Shared Document

A Frame is not an iframe. Its response becomes ordinary DOM inside the parent document, so inherited CSS custom properties theme checked-in HTML, server-rendered Remix UI, and hydrated client components together. The theme control changes `data-theme` on the document root and persists the value in a cookie; existing Frames update in place without losing client state or making another request.

For motion content, `pauseAnimationsWhenInactive` adds a zero-margin observer. `LazyFrame` applies a host-level `css()` mixin while that host is outside the viewport, pausing descendant animations until it returns. The Frame stays mounted throughout; non-motion Frames avoid the extra observer.

## Response Shapes

| Frame route               | Response                                         | Demonstrates                                                    |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `/frames/html/:id`        | A checked-in `.html` fragment streamed from disk | Frames do not require the Remix UI renderer                     |
| `/frames/ui/:id`          | Server-rendered Remix UI                         | Components and generated styles delivered as frame HTML         |
| `/frames/interactive/:id` | Remix UI containing a `clientEntry`              | Client components discovered and hydrated after frame insertion |

## Explore the Code

- [`app/ui/public/lazy-frame.tsx`](app/ui/public/lazy-frame.tsx) owns Frame mounting and optional stage activity. Its `children` and `fallback` props keep waiting and fetching presentation caller-owned, while its host-level `css()` mixin demonstrates styling Frame descendants from outside the response.
- [`app/ui/public/theme-toggle.tsx`](app/ui/public/theme-toggle.tsx) updates the root theme and its browser-writable preference cookie without navigating or reloading Frames.
- [`app/actions/home.tsx`](app/actions/home.tsx) compares eager and lazy delivery of the same artifact, then composes nine more sections without repeating browser lifecycle code.
- [`app/middleware/theme.ts`](app/middleware/theme.ts) supplies the saved theme during server rendering, while [`app/ui/document.tsx`](app/ui/document.tsx) defines the shared light and dark design tokens inherited by every response shape.
- [`app/middleware/demo-latency.ts`](app/middleware/demo-latency.ts) reads the latency cookie, exposes its state through typed request context, and applies the delay across the middleware stack.
- [`app/actions/frames/controller.tsx`](app/actions/frames/controller.tsx) shows the three response strategies behind one typed route map. Plain HTML routes use `openLazyFile()` and `createFileResponse()` to stream files from [`app/actions/frames/html`](app/actions/frames/html). [`edition-orbit.html`](app/actions/frames/html/edition-orbit.html) models a motion-pipeline artifact with scoped inline CSS, prefixed keyframes, and a reduced-motion fallback.
- [`app/actions/frames/public/frame-playground.tsx`](app/actions/frames/public/frame-playground.tsx) is loaded only when an interactive frame arrives. Its local count survives a containing-frame reload.
- [`app/app.test.e2e.ts`](app/app.test.e2e.ts) verifies eager SSR versus lazy browser delivery, root-level theming without refetching, viewport-driven motion pausing, one-request retention, and hydration of client components inserted by a Frame.

Run `pnpm test` and `pnpm typecheck` to validate the demo.
