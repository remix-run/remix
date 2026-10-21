Prefetch pages before a visitor opens them by adding `data-rmx-prefetch="intent"` to a link. Remix starts loading the page when the mouse or keyboard focus rests on the link for 100ms, or when it's pressed. Call `prefetch(href)` to do the same from a script:

```tsx
<a href="/products/shirt" data-rmx-prefetch="intent">
  Shirt
</a>
```

By default Remix fetches the HTML with a low-priority hint and discovers explicit JavaScript and CSS URLs, plus image and font preload declarations, for `<link rel="prefetch">` hints without activating the destination's scripts, styles, or import map. Images and fonts must be declared with `<link rel="preload" as="image|font" href="…">`; their media conditions and CORS settings are honored, and image declarations with `imagesrcset` are skipped. Navigation uses the default resolver and browser HTTP cache. Cacheable HTML can be reused; `no-store` HTML is fetched again while its cacheable assets can still be prefetched. Apps can pass `prefetch` to `run()` to replace this strategy (see #12054).
