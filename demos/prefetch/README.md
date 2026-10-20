# Prefetch Demo

A small catalog showing Remix's default HTML and asset prefetching. Every product takes 800ms to render. Asset responses have a 200ms delay so pending hints are easier to inspect in the DOM; cache hits bypass this delay.

## Running the demo

```sh
pnpm install
pnpm --filter prefetch-demo dev
```

Open [http://localhost:44100](http://localhost:44100) in Chrome or Firefox.

To observe caching with fingerprinted, immutable assets, run the production server:

```sh
NODE_ENV=production pnpm --filter prefetch-demo start
```

## What to try

- Hover or focus a product under **Prefetched on intent**, wait a moment, then open it. Watch its HTML load first in the Network panel, followed by script and stylesheet prefetches while the catalog remains on screen.
- Search for “mug”. When one product matches, the search calls `prefetch()` programmatically. Enamel Mug's HTML uses `Cache-Control: no-store`, so navigation requests it again. Its cacheable assets can still be warmed before navigation.
- Click a product under **Not prefetched** to see the render delay.
- Click **Add one** on a product page. This client entry and its external stylesheet are only needed on product pages and can be discovered before navigation.

Most products use `Cache-Control: private, max-age=30`. The product's rendered timestamp helps identify whether navigation reused HTML. Both speculative HTML requests and navigations send the normal frame headers, so both display `frame request` as their request type.

## Default behavior

The [browser entry](https://github.com/remix-run/remix/blob/main/demos/prefetch/app/actions/public/entry.tsx) supplies module-loading hooks and leaves `prefetch` and `resolveFrame` at their defaults. There is no application prefetch implementation or response cache.

Remix fetches same-origin HTML with GET, reads it into an inert template, and discovers explicit external scripts and stylesheet/preload links, including those inside nested templates. It creates temporary `<link rel="prefetch" as="script|style">` hints in the document head. These remain connected through frame navigation and are removed on load, error, or runtime disposal. Browsers without link-prefetch support skip the asset hints.

The [runtime implementation](https://github.com/remix-run/remix/blob/main/packages/component/src/runtime/default-prefetch.ts) deduplicates pending work and discards consumed HTML. Navigation uses the default frame resolver and the browser HTTP cache. Fresh HTML can be reused, `no-cache` HTML revalidates, and `no-store` HTML is fetched again. Early navigation starts independently; the browser decides whether unfinished requests can share work.

## Boundaries

Discovery does not boot the destination, install its import map, execute scripts, or apply styles. It warms explicit URLs without following module imports, CSS `@import`, or CSS images and fonts. Dependencies that need warming must appear in the HTML's resource declarations. Normal navigation handles import maps and module loading when the destination becomes active.

Asset prefetches are browser hints and may be deferred or ignored. Later loads rely on the browser's cache policy and may miss or revalidate. Dev mode assets deliberately do not provide production caching behavior; use the production server when comparing request counts and transferred bytes.

See [Prefetching](https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md#prefetching) for eligibility rules and custom hooks, and [the decision document](https://github.com/remix-run/remix/blob/main/decisions/007-frame-prefetch-assets.md) for the four approaches evaluated.
