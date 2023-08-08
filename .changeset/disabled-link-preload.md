---
"@remix-run/react": patch
---

Add `<link rel="preload">` timeout counter and disabling logic in case preloading is disabled by the user in Firefox.  This prevents us from hanging on client-side navigations when we try to preload stylesheets and never receive a `load`/`error` event on the `link` tag.
