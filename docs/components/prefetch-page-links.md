---
title: PrefetchPageLinks
toc: false
---

# `<PrefetchPageLinks />`

This component enables prefetching of all assets for a page to enable an instant navigation to that page. It does this by rendering `<link rel="prefetch">` and `<link rel="modulepreload"/>` tags for all the assets (data, modules, CSS) of a given page.

`<Link rel="prefetch">` uses this internally, but you can render it to prefetch a page for any other reason.

```tsx
<PrefetchPageLinks page="/absolute/path/to/your-path" />
```

**Note:** You need to use an absolute path.
