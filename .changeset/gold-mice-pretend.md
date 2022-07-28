---
"remix": patch
"@remix-run/dev": patch
---

use esbuild's new automatic jsx transform

there are no code changes from your end, but by using the new transform, we can prevent duplicate React imports from appearing in your build (#2987)
