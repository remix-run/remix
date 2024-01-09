---
title: SPA Mode (Unstable)
---

# SPA Mode (Unstable)

From the beginning, Remix's opinion has always been that you own your server architecture. This is why Remix is built on top of the [Web Fetch API][fetch] and can run on any modern [runtime][runtimes] via built-in or community-provided adapters. While we believe that having a server provides the best UX/Performance/SEO/etc. for _most_ apps, it is also undeniable that there exist plenty of valid use cases for a Single Page Application in the real world:

- You don't want to manage a server and prefer to deploy your app via static files on Github Pages or another CDN
- You don't want to run a Node.js server
- You're developing a special type of embedded app that can't be server rendered
- "Your boss couldn't care less about the UX ceiling of SPA architecture and won't give your dev teams time/capacity to re-architect things" [- Kent C. Dodds][kent-tweet]

That's why we added support for **SPA Mode** in [2.5.0][2.5.0] ([RFC][rfc]), which builds heavily on top of the [Client Data][client-data] APIs.

<docs-info>SPA Mode requires your app to be using Vite and the [Remix Vite Plugin][remix-vite]</docs-info>

## What is SPA Mode?

SPA Mode is basically what you'd get if you had your own [React Router + Vite][rr-setup] setup using `createBrowserRouter`/`RouterProvider`, but along with some extra Remix goodies:

- File-based routing (or config-based via [`routes()`][routes-config])
- Automatic route-based code-spitting via [`route.lazy`][route-lazy]
- `<Link prefetch>` support to eagerly prefetch route modules
- `<head>` management via Remix [`<Meta>`][meta]/[`<Links>`][links] APIs if you choose to hydrate the full `document`

SPA Mode tells Remix that you do not plan on running a Remix server at runtime and that you wish to generate a static `index.html` file at build time and you will only use [Client Data][client-data] APIs for data loading and mutations.

The `index.html` is generated from the `HydrateFallback` component in your `root.tsx` route. The initial "render" to generate the `index.html` will not include any routes deeper than root. This ensures that the `index.html` file can be served/hydrated for paths beyond `/` (i.e., `/about`) if you configure your CDN/server to do so.

## Usage

### Template

You can get started quickly using the SPA Mode template in the repo:

```shellscript
npx create-remix@latest --template remix-run/remix/templates/spa
```

### Manual Setup

To manually setup SPA mode in your Remite+Vite app, you can opt-in by setting `unstable_ssr: false` in your Remix Vite plugin config:

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

To run your SPA, you serve your client assets directory via any HTTP server you wish, for example:

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

## Notes/Caveats

- SPA Mode only works when using Vite and the [Remix Vite plugin][remix-vite]

- You cannot use server APIs such as `headers`, `loader`, and `action` -- the build will throw an error if you export them

- You can only export a `HydrateFallback` from your `root.tsx` in SPA Mode -- the build will throw an error if you export one from any other routes.

- You cannot call `serverLoader`/`serverAction` from your `clientLoader`/`clientAction` methods since there is no running server -- those will throw a runtime error if called

## Migrating from React Router

We also expect SPA Mode to be useful in helping folks migrate existing React router apps over to Remix apps (SPA or not!).

The first step towards this migration is getting your current React Router app running on `vite`, so that you've got whatever plugins you need for your non-JS code (i.e., CSS, SVG, etc.).

**If you are currently using `BrowserRouter`**

Once you're using vite, you should be able to drop your `BrowserRouter` app into a catch-all Remix route per the steps in the [this guide][migrating-rr].

**If you are currently using `RouterProvider`**

If you are currently using `RouterProvider`, then the best approach is to move your routes to individual files and load them via `route.lazy`:

- Name these files according to the Remix file conventions to make the move to Remix (SPA) easier
- Export your route components as a named `Component` export (for RR) and also a `default` export (for eventual use by Remix)

Once you've got all your routes living in their own files, you can:

- Move those files over into the Remix `app/` directory
- Enable SPA Mode
- Rename all `loader`/`action` function to `clientLoader`/`clientAction`
- Replace your React Router `index.html` file with an `app/root.tsx` route that exports a `default` component and `HydrateFallback`

[rfc]: https://github.com/remix-run/remix/discussions/7638
[client-data]: ../guides/client-data
[2.5.0]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#v250
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[runtimes]: ../discussion/runtimes
[kent-tweet]: https://twitter.com/kentcdodds/status/1743030378334708017
[rr-setup]: https://reactrouter.com/en/main/start/tutorial#setup
[routes-config]: ../file-conventions/remix-config#routes
[route-lazy]: https://reactrouter.com/en/main/route/lazy
[meta]: ../components/meta
[links]: ../components/links
[migrating-rr]: https://remix.run/docs/en/main/guides/migrating-react-router-app
[remix-vite]: ../future/vite
