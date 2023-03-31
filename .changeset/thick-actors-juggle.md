---
"@remix-run/react": minor
---

Added deprecation warning for normalizing `imagesizes` & `imagesrcset` properties returned from the route `links` function. Both properties should be in camelCase (`imageSizes`/ `imageSrcSet`) to align with their respective JavaScript properties.
