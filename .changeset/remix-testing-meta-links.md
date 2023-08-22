---
"@remix-run/testing": minor
---

- `unstable_createRemixStub` now supports adding `meta`/`links` functions on stubbed Remix routes
- ⚠️ `unstable_createRemixStub` no longer supports the `element`/`errorElement` properties on routes. You must use `Component`/`ErrorBoundary` to match what you would export from a Remix route module.
