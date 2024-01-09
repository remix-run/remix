---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
"@remix-run/testing": minor
---

Add unstable support for "SPA Mode"

You can opt into SPA Mode by setting `unstable_ssr: false` in your Remix Vite plugin config:

```js
// vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix({ unstable_ssr: false })],
});
```

Development in SPA Mode is just like a normal Remix app, and still uses the Remix dev server for HMR/HDR:

```sh
remix vite:dev
```

Building in SPA Mode will generate an `index.html` file in your client assets directory:

```sh
remix vite:build
```

To run your SPA, you serve your client assets directory via an HTTP server:

```sh
npx http-server build/client
```

For more information, please refer to the [SPA Mode docs][https://remix.run/future/spa-mode].
