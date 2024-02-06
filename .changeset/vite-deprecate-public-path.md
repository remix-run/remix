---
"@remix-run/dev": patch
---

Vite: Remove the ability to pass `publicPath` as an option to the Remix vite plugin
  - ⚠️ **This is a breaking change for projects using the unstable Vite plugin with a `publicPath`**
  - This is already handled in Vite via the [`base`](https://vitejs.dev/guide/build.html#public-base-path) config so we now set the Remix `publicPath` from the Vite `base` config