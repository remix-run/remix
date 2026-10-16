# Prefetch Demo

A small catalog that shows how Remix prefetches pages before a visitor opens them. Every product page takes 800ms to render, so you can feel the difference between prefetched and plain links.

## Running the demo

```sh
pnpm install
pnpm --filter prefetch-demo dev
```

Open [http://localhost:44100](http://localhost:44100) in Chrome or Firefox.

## What to try

- **Hover a product under "Prefetched on intent"**, wait a moment, then click it. The page opens instantly, and its "Requested as" line reads `prefetch`: the navigation reused the response the browser loaded while you hovered.
- **Tab to a prefetched product** and press Enter. Keyboard focus counts as intent too.
- **Click a product under "Not prefetched".** The page takes 800ms, and "Requested as" reads `frame navigation`.
- **Search for "mug".** Once the search narrows to one product, `prefetch()` starts loading it, so the result opens instantly.

Open the Network panel to watch the prefetch requests go out on hover.

Product pages are cacheable for 30 seconds, so opening a product again within that window also reuses the cached response.

## Key patterns

- `data-rmx-prefetch="intent"` on the prefetched product links in [`app/ui/product-card.tsx`](./app/ui/product-card.tsx)
- `prefetch()` from a client entry in [`app/actions/public/product-search.tsx`](./app/actions/public/product-search.tsx)
- `Cache-Control: private, max-age=30` on product pages in [`app/actions/controller.tsx`](./app/actions/controller.tsx). Remix prefetches with `<link rel="prefetch">` by default, and the browser only reuses that response when the page is HTTP-cacheable.
- Reading `Sec-Purpose: prefetch` on the server to tell prefetch requests apart

Safari doesn't support `<link rel="prefetch">`, so it opens every product with a regular frame navigation. Apps whose pages can't be HTTP-cached can pass `prefetch` to `run()` to load pages another way. See [Prefetching](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md#prefetching).
