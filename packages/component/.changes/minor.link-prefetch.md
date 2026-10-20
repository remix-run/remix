Prefetch pages before a visitor opens them by adding `data-rmx-prefetch="intent"` to a link. Remix starts loading the page when the mouse or keyboard focus rests on the link for 100ms, or when it's pressed. Call `prefetch(href)` to do the same from a script:

```tsx
<a href="/products/shirt" data-rmx-prefetch="intent">
  Shirt
</a>
```

By default Remix fetches the HTML with a low-priority hint and discovers explicit JavaScript and CSS URLs for `<link rel="prefetch">` hints, without activating the destination's scripts, styles, or import map. Navigation uses the default resolver and browser HTTP cache. Cacheable HTML can be reused; `no-store` HTML is fetched again while its cacheable assets can still be prefetched. Apps can pass `prefetch` to `run()` to replace this strategy (see #12004).

Custom frame resolvers can delegate cache misses to the exported `defaultResolveFrame(src, options)` helper to preserve the default request headers, form encoding, cancellation, and response handling without reimplementing them.
