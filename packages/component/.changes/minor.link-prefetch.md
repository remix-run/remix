Prefetch pages before a visitor opens them with `data-rmx-prefetch="intent"` or `data-rmx-prefetch="viewport"`. Intent links start loading when the mouse or keyboard focus rests on them for 100ms, or when they're pressed. Each intent link triggers once while hovered or focused, so moving between its children or pressing it after hovering does not repeat the prefetch. Hover and focus on separate links are tracked independently. Viewport links start loading when they enter the viewport, once while mounted with the same destination. Newly inserted links and changed destinations are observed automatically; browsers without `IntersectionObserver` skip viewport prefetching.

```tsx
<a href="/products/shirt" data-rmx-prefetch="intent">
  Shirt
</a>
<a href="/products/hat" data-rmx-prefetch="viewport">
  Hat
</a>
```

Call `prefetch(href)` to do the same from a script:

```ts
import { prefetch } from 'remix/component'

prefetch('/products/shirt')
```

By default Remix fetches the HTML with a low-priority hint and discovers explicit JavaScript and CSS URLs, plus image and font preload declarations, for `<link rel="prefetch">` hints without activating the destination's scripts, styles, or import map. Images and fonts must be declared with `<link rel="preload" as="image|font" href="…">`; their media conditions and CORS settings are honored, and image declarations with `imagesrcset` are skipped. Navigation uses the default resolver and browser HTTP cache. Cacheable HTML can be reused; `no-store` HTML is fetched again while its cacheable assets can still be prefetched. Apps can pass `prefetch` to `run()` to replace this strategy (see #12004).
