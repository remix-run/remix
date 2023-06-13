---
"@remix-run/react": patch
---

Detect mismatches between the initially loaded URL and the URL at the time we hydrate and trigger a hard reload if they do not match. This is an edge-case that can happen when the network is slowish and the user clicks forward into a Remix app and then clicks forward again while the initial JS chunks are loading.
