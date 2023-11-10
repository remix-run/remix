---
"@remix-run/dev": patch
---

Fix Vite production builds when plugins that have different local state between `development` and `production` modes are present, e.g. `@mdx-js/rollup`.
