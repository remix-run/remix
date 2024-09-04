---
"@remix-run/dev": patch
---

(unstable) Automatic dependency optimization

You can now opt-in to automatic dependency optimization during development by using the `future.unstable_optimizeDeps` future flag.
For details, check out the docs at [`Guides` > `Dependency optimization`](https://remix.run/docs/en/main/guides/dependency-optimization).

For users who were previously working around this limiation, you no longer need to explicitly add routes to Vite's `optimizeDeps.entries` nor do you need to disable the `remix-dot-server` plugin.
