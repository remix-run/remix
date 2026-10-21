Prefetch pages before a visitor opens them with `data-rmx-prefetch="intent"` or `data-rmx-prefetch="viewport"`. Intent links start loading when the mouse or keyboard focus rests on them for 100ms, or when they're pressed. Each intent link triggers once while hovered or focused, so moving between its children or pressing it after hovering does not repeat the prefetch. Hover and focus on separate links are tracked independently. Viewport links start loading when they enter the viewport, once while mounted with the same frame source and target. Newly inserted links and changed requests are observed automatically; browsers without `IntersectionObserver` skip viewport prefetching.

```tsx
<a href="/products/shirt" data-rmx-prefetch="intent">
  Shirt
</a>
<a href="/products/hat" data-rmx-prefetch="viewport">
  Hat
</a>
```

Named-frame links with `data-rmx-target` are supported in both modes. Prefetching uses `data-rmx-src` when present and sends `X-Remix-Target`, matching frame navigation. Both the destination and source must be same-origin; links to missing frames, document navigations, downloads, and links opening another browsing context are skipped. Viewport links become eligible again when their requested source or target changes.

Call `prefetch(href, options?)` to do the same from a script. Pass `target` for a named frame:

```ts
import { prefetch } from 'remix/component'

prefetch('/products/shirt')
prefetch('/partials/shirt', { target: 'details' })
```

By default Remix fetches the HTML with a low-priority hint and discovers explicit JavaScript and CSS URLs, plus image and font preload declarations, for `<link rel="prefetch">` hints without activating the destination's scripts, styles, or import map. Images and fonts must be declared with `<link rel="preload" as="image|font" href="…">`; their media conditions and CORS settings are honored, and image declarations with `imagesrcset` are skipped. Navigation uses the default resolver and browser HTTP cache. Cacheable HTML can be reused; `no-store` HTML is fetched again while its cacheable assets can still be prefetched. Apps can provide a `prefetch(src, options)` hook through `run({ prefetch })` to replace this strategy; the optional `options.target` identifies named-frame requests. Pending HTML discovery is deduplicated by source and target (see #12004).
