Prefetch pages before a visitor opens them by adding `data-rmx-prefetch="intent"` to a link. Remix starts loading the page when the mouse or keyboard focus rests on the link for 100ms, or when it's pressed. Call `prefetch(href)` to do the same from a script:

```tsx
<a href="/products/shirt" data-rmx-prefetch="intent">
  Shirt
</a>
```

By default Remix adds a `<link rel="prefetch">`, and the next navigation's `resolveFrame` request reuses the response from the browser's HTTP cache. That requires an HTTP-cacheable response, such as `Cache-Control: private, max-age=30`, that doesn't `Vary` on `X-Remix-Frame`. Apps whose pages can't be cached can pass `prefetch` to `run()` to load pages another way, such as holding responses in memory for their `resolveFrame` to reuse (see #12004).
