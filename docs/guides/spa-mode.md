---
title: SPA Mode
---

# SPA Mode

From the beginning, Remix's opinion has always been that you own your server architecture. This is why Remix is built on top of the [Web Fetch API][fetch] and can run on any modern [runtime][runtimes] via built-in (or community-provided) adapters. While we believe that having a server provides the best UX/Performance/SEO/etc. for _most_ apps, it is also undeniable that there exist plenty of valid use cases for a Single Page Application in the real world:

- You prefer to deploy your app via static files on Github Pages or another CDN
- You don't want to manage a server, or run a Node.js server
- You're developing a special type of embedded app that can't be server rendered
- "Your boss couldn't care less about the UX ceiling of SPA architecture and won't give your dev teams time/capacity to re-architect things" [- Kent C. Dodds][kent-tweet]

That's why we added support for **SPA Mode** in [2.5.0][2.5.0] (per this [RFC][rfc]), which builds heavily on top of the [Client Data][client-data] APIs.

## What is SPA Mode?

SPA Mode is basically what you'd get if you had your own [React Router + Vite][rr-setup] setup using `createBrowserRouter`/`RouterProvider`, but along with some extra Remix goodies:

- File-based routing (or config-based via [`routes()`][routes-config])
- Automatic route-based code-spitting via [`route.lazy`][route-lazy]
- `<head>` management via Remix [`<Meta>`][meta]/[`<Links>`][links] APIs

SPA Mode tells Remix that you do not plan on running a Remix server at runtime and that you wish to generate a static `index.html` file at build time and you will only use [Client Data](https://remix.run/docs/en/main/guides/client-data) APIs for data loading and mutations.

The `index.html` is generated from your root route. You **should** include a `HydrateFallback` component containing the app shell/initial loading state. The initial "render" to generate the `index.html` will not include any routes deeper than root. This ensures that the `index.html` file can be served/hydrated for paths beyond `/` (i.e., `/about`) if you configure your CDN/server to do so.

## Usage

You can opt into SPA mode by setting `unstable_ssr: false` in your Remix Vite plugin config:

```js
// vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      unstable_ssr: false,
    }),
  ],
});
```

### Development

In SPA Mode, you develop the same way you would for a traditional Remix SSR app, and you actually use a running Remix dev server in order to enable HMR/HDR:

```sh
remix vite:dev
```

### Production

When you build your app in SPA Mode, Remix will call the server handler for the `/` route and save the rendered HTML in an `index.html` file alongside your client side assets (by default `build/client/index.html`).

```sh
remix vite:build
```

To run your SPA, you simply serve your client assets directory (which contains `index.html`) via any HTTP server you wish, for example:

```sh
npx http-server build/client/
```

Or, if you are serving via an `express` server (although at that point you may want to consider just running Remix in SSR mode 😉):

```js
app.use("/assets", express.static("build/client/assets"));
app.get("*", (req, res, next) =>
  res.sendFile(
    path.join(process.cwd(), "build/client/index.html"),
    next
  )
);
```

**Notes/Caveats:**

- You cannot use server APIs such as `headers`, `loader`, and `action` -- the build will throw an error if you export them

- You cannot call `serverLoader`/`serverAction` from your `clientLoader`/`clientAction` methods since there is no running server -- those will throw a runtime error if called

[rfc]: https://github.com/remix-run/remix/discussions/7638
[client-data]: ./client-data
[2.5.0]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#v250
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[runtimes]: ../discussion/runtimes
[kent-tweet]: https://twitter.com/kentcdodds/status/1743030378334708017
[rr-setup]: https://reactrouter.com/en/main/start/tutorial#setup
[routes-config]: ../file-conventions/remix-config#routes
[route-lazy]: https://reactrouter.com/en/main/route/lazy
[meta]: ../components/meta
[links]: ../components/links
