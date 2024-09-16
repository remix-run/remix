---
title: SPA Mode
---

# SPA Mode

From the beginning, Remix's opinion has always been that you own your server architecture. This is why Remix is built on top of the [Web Fetch API][fetch] and can run on any modern [runtime][runtimes] via built-in or community-provided adapters. While we believe that having a server provides the best UX/Performance/SEO/etc. for _most_ apps, it is also undeniable that there exist plenty of valid use cases for a Single Page Application in the real world:

- You don't want to manage a server and prefer to deploy your app via static files on Github Pages or another CDN
- You don't want to run a Node.js server
- You want to [migrate a React Router app][migrate-rr] to Remix
- You're developing a special type of embedded app that can't be server rendered
- "Your boss couldn't care less about the UX ceiling of SPA architecture and won't give your dev teams time/capacity to re-architect things" [- Kent C. Dodds][kent-tweet]

That's why we added support for **SPA Mode** in [2.5.0][2.5.0] ([RFC][rfc]), which builds heavily on top of the [Client Data][client-data] APIs.

<docs-info>SPA Mode requires your app to be using Vite and the [Remix Vite Plugin][remix-vite]</docs-info>

## What is SPA Mode?

SPA Mode is basically what you'd get if you had your own [React Router + Vite][rr-setup] setup using `createBrowserRouter`/`RouterProvider`, but along with some extra Remix goodies:

- File-based routing (or config-based via [`routes()`][routes-config])
- Automatic route-based code-splitting via [`route.lazy`][route-lazy]
- `<Link prefetch>` support to eagerly prefetch route modules
- `<head>` management via Remix [`<Meta>`][meta]/[`<Links>`][links] APIs

SPA Mode tells Remix that you do not plan on running a Remix server at runtime and that you wish to generate a static `index.html` file at build time and you will only use [Client Data][client-data] APIs for data loading and mutations.

The `index.html` is generated from the `HydrateFallback` component in your `root.tsx` route. The initial "render" to generate the `index.html` will not include any routes deeper than root. This ensures that the `index.html` file can be served/hydrated for paths beyond `/` (i.e., `/about`) if you configure your CDN/server to do so.

## Usage

You can get started quickly using the SPA Mode template in the repo:

```shellscript
npx create-remix@latest --template remix-run/remix/templates/spa
```

Or, you can manually opt-into SPA mode in your Remix+Vite app by setting `ssr: false` in your Remix Vite plugin config:

```js
// vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      ssr: false,
    }),
  ],
});
```

### Development

In SPA Mode, you develop the same way you would for a traditional Remix SSR app, and you actually use a running Remix dev server in order to enable HMR/HDR:

```sh
npx remix vite:dev
```

### Production

When you build your app in SPA Mode, Remix will call the server handler for the `/` route and save the rendered HTML in an `index.html` file alongside your client side assets (by default `build/client/index.html`).

```sh
npx remix vite:build
```

#### Preview

You can preview the production build locally with [vite preview][vite-preview]:

```shellscript
npx vite preview
```

<docs-warning>`vite preview` is not designed for use as a production server</docs-warning>

#### Deployment

To deploy, you can serve your app from any HTTP server of your choosing. The server should be configured to serve multiple paths from a single root `/index.html` file (commonly called "SPA fallback"). Other steps may be required if the server doesn't directly support this functionality.

For a simple example, you could use [sirv-cli][sirv-cli]:

```shellscript
npx sirv-cli build/client/ --host 0.0.0.0 --port 3000 --single
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

## Hydrating a div instead of the full document

If you don't want to hydrate the full HTML `document`, you can choose to use SPA mode and only hydrate a sub-section of the document such as `<div id="app">` with a few minor changes.

**1. Add an `index.html` file**

Since Remix won't render the HTML document, you will need to provide that HTML outside of Remix. The easiest way to do this is to just keep an `app/index.html` document with a placeholder you can replace with the Remix rendered HTML at build time to generate the final `index.html`

```html filename=app/index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>My Cool App!</title>
  </head>
  <body>
    <div id="app"><!-- Remix SPA --></div>
  </body>
</html>
```

The `<!-- Remix SPA -->` HTML comment is what we'll replace with the Remix HTML.

<docs-info>Because whitespace is meaningful in the DOM/VDOM tree - it's important not to include any spaces around it and the surrounding `div`, otherwise you will run into React hydration issues</docs-info>

**2. Update `root.tsx`**

Update your root route to render just the contents of `<div id="app">`:

```tsx filename=app/root.tsx
export function HydrateFallback() {
  return (
    <>
      <p>Loading...</p>
      <Scripts />
    </>
  );
}

export default function Component() {
  return (
    <>
      <Outlet />
      <Scripts />
    </>
  );
}
```

**3. Update `entry.server.tsx`**

In your `app/entry.server.tsx` file, you'll want to take the Remix-rendered HTML and insert it into your static `app/index.html` file placeholder. You'll also want to stop pre-pending the `<!DOCTYPE html>` declaration like the default `entry.server.tsx` file does since that should be in your `app/index.html` file).

```tsx filename=app/entry.server.tsx
import fs from "node:fs";
import path from "node:path";

import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const shellHtml = fs
    .readFileSync(
      path.join(process.cwd(), "app/index.html")
    )
    .toString();

  const appHtml = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  const html = shellHtml.replace(
    "<!-- Remix SPA -->",
    appHtml
  );

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
    status: responseStatusCode,
  });
}
```

<docs-info>You may need to run `npx remix reveal` if you don't currently have an `app/entry.server.tsx` file in your app</docs-info>

**4. Update `entry.client.tsx`**

Update `app/entry.client.tsx` to hydrate the `<div id="app">` instead of the document:

```tsx filename=app/entry.client.tsx
import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

startTransition(() => {
  hydrateRoot(
    document.querySelector("#app"),
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
```

<docs-info>You may need to run `npx remix reveal` if you don't currently have an `app/entry.client.tsx` file in your app</docs-info>

## Notes/Caveats

- SPA Mode only works when using Vite and the [Remix Vite plugin][remix-vite]

- You cannot use server APIs such as `headers`, `loader`, and `action` -- the build will throw an error if you export them

- You can only export a `HydrateFallback` from your `root.tsx` in SPA Mode -- the build will throw an error if you export one from any other routes.

- You cannot call `serverLoader`/`serverAction` from your `clientLoader`/`clientAction` methods since there is no running server -- those will throw a runtime error if called

### Server Build

It's important to note that Remix SPA mode generates your `index.html` file by performing a "pre-render" of your root route on the server during the build

- This means that while you're creating a SPA, you still have a "server build" and "server render" step, so you do need to be careful about using dependencies that reference client-only aspects such as `document`, `window`, `localStorage`, etc.
- Generally speaking, the way to resolve these issues is to import any browser-only libraries from `entry.client.tsx` so they don't end up in the server build
- Otherwise, you can generally solve these by using [`React.lazy`][react-lazy] or the [`<ClientOnly>`][client-only] component from `remix-utils`

### CJS/ESM Dependency Issues

If you are running into ESM/CJS issues with your app dependencies you may need to play with the Vite [ssr.noExternal][vite-ssr-noexternal] option to include certain dependencies in your server bundle:

```ts filename=vite.config.ts lines=[12-15]
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    remix({
      ssr: false,
    }),
    tsconfigPaths(),
  ],
  ssr: {
    // Bundle `problematic-dependency` into the server build
    noExternal: ["problematic-dependency"],
  },
  // ...
});
```

These issues are usually due to dependencies whose published code is incorrectly-configured for CJS/ESM. By including the specific dependency in `ssr.noExternal`, Vite will bundle the dependency into the server build and can help avoid runtime import issues when running your server.

If you have the opposite use-case and you specifically want to keep dependencies external to the bundle, you can use the opposite [`ssr.external`][vite-ssr-external] option.

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
[remix-vite]: ./vite
[migrate-rr]: #migrating-from-react-router
[react-lazy]: https://react.dev/reference/react/lazy
[client-only]: https://github.com/sergiodxa/remix-utils?tab=readme-ov-file#clientonly
[vite-preview]: https://vitejs.dev/guide/cli#vite-preview
[sirv-cli]: https://www.npmjs.com/package/sirv-cli
[vite-ssr-noexternal]: https://vitejs.dev/config/ssr-options#ssr-noexternal
[vite-ssr-external]: https://vitejs.dev/config/ssr-options#ssr-external
