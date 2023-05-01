---
"@remix-run/dev": patch
---

don't forward on injects for CSS compiler as it's never loading any JS code and esbuild seems to have a bug with CSS entries + inject
