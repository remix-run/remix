---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
"@remix-run/testing": minor
---

Add unstable support for "SPA Mode"

You can opt into SPA mode by setting `unstable_ssr: false` in your Remix Vite plugin config:

```js
// vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({ unstable_ssr: false }),
  ],
});
```

SPA Mode tells Remix that you do not plan on running a Remix server at runtime and that you wish to spit out a static `index.html` file instead and leverage [Client Data](https://remix.run/docs/en/main/guides/client-data) APIs for data loading and mutations.

The `index.html` is generated from your root route -- you should include a `HydrateFallback` component containing the app shell/initial loading state.  The initial "render" to generate the `index.html` will not include any routes deeper than root - this ensures that the index.html file can be served/hydrated for paths beyond `/` (i.e., `/about`) if you configure your CDN/server to do so

For the most part, SPA mode works mostly the same as a normal Remix app.  You develop the same way via `remix vite:dev` and you actually use a running Remix Server for development (in order to enable HMR/HDR).  At build time (`remix vite:build`) Remix will call the server handler for the `/` route and save the returned HTML to `build/client/index.html`.

To run your SPA, you simply serve your client assets directory (which contains `index.html`) via any HTTP server you wish, for example:

```sh
npx http-server build/client/
```

Or, if you are serving via an `express` server (although at that point you may want to consider just running Remix in SSR mode 😉):

```js
app.get("/assets", express.static("build/client/assets"));
app.get("*", (req, res, next) =>
  res.sendFile(path.join(process.cwd(), "build/client/index.html"), next)
);
```

**Notes/Caveats:**

- You cannot use server APIs such as `headers`, `loader`, and `action` -- the build will throw an error if you export them

- You cannot call `serverLoader`/`serverAction` from your `clientLoader`/`clientAction` methods since there is no running server -- those will throw a runtime error if called
