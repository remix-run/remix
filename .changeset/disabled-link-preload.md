---
"@remix-run/react": patch
---

Skip preloading of stylesheets on client-side route transitions if the browser does not support `<link rel=preload>`. This prevents us from hanging on client-side navigations when we try to preload stylesheets and never receive a `load`/`error` event on the `link` tag.
