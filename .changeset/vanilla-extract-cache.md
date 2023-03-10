---
"@remix-run/dev": minor
---

Add experimental support for Vanilla Extract caching which can be enabled by setting `future.unstable_vanillaExtract: { cache: true }` in `remix.config`. This is considered experimental due to the use of a brand new Vanilla Extract compiler under the hood. Note that in order to use this feature, you must be using at least `v1.10.0` of `@vanilla-extract/css`.
