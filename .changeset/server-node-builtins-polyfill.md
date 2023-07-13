---
"@remix-run/dev": minor
---

Add `serverNodeBuiltinsPolyfill` config option. You can now disable polyfills of Node.js built-in modules for non-Node.js server platforms by setting `serverNodeBuiltinsPolyfill: false` in `remix.config.js`. You can also provide a list of server polyfills, e.g. `serverNodeBuiltinsPolyfill: ["crypto"]`.
