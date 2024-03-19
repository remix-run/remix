---
title: Server Bundles
---

# Server Bundles

<docs-warning>This is an advanced feature designed for hosting provider integrations. When compiling your app into multiple server bundles, there will need to be a custom routing layer in front of your app directing requests to the correct bundle.</docs-warning>

Remix typically builds your server code into a bundle that exposes a single request handler function. However, there are some scenarios where you might want to split your route tree into multiple server bundles that expose a request handler function for a subset of routes. To provide this level of flexibility, the [Remix Vite plugin][remix-vite] supports an `serverBundles` option which is a function for assigning routes to different server bundles.

The provided `serverBundles` function is called for each route in the tree (except for routes that aren't addressable, e.g. pathless layout routes) and returns a server bundle ID that you'd like to assign it to. These bundle IDs will be used as directory names in your server build directory.

For each route, this function is passed an array of routes leading to and including that route, referred to as the route `branch`. This allows you to create server bundles for different portions of the route tree. For example, you could use this to create a separate server bundle containing all routes within a particular layout route:

```ts filename=vite.config.ts lines=[7-15]
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      serverBundles: ({ branch }) => {
        const isAuthenticatedRoute = branch.some((route) =>
          route.id.split("/").includes("_authenticated")
        );

        return isAuthenticatedRoute
          ? "authenticated"
          : "unauthenticated";
      },
    }),
  ],
});
```

Each `route` in the `branch` array contains the following properties:

- `id` — The unique ID for this route, named like its `file` but relative to the app directory and without the extension, e.g. `app/routes/gists.$username.tsx` will have an `id` of `routes/gists.$username`.
- `path` — The path this route uses to match on the URL pathname.
- `file` — The absolute path to the entry point for this route.
- `index` — Whether or not this route is an index route.

## Build manifest

When the build is complete, Remix will call the Vite plugin's `buildEnd` hook passing a `buildManifest` object. This is useful if you need to inspect the build manifest to determine how to route requests to the correct server bundle.

```ts filename=vite.config.ts lines=[8-10]
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      // ...
      buildEnd: async ({ buildManifest }) => {
        // ...
      },
    }),
  ],
});
```

When using server bundles, the build manifest contains the following properties:

- `serverBundles` — An object that maps bundle IDs to the bundle's `id` and `file`.
- `routeIdToServerBundleId` — An object that maps route IDs to its server bundle ID.
- `routes` — A route manifest that maps route IDs to route metadata. This can be used to drive a custom routing layer in front of your Remix request handlers.

Alternatively, you can enable the `manifest` option on the Vite plugin to write this build manifest object to disk as `.remix/manifest.json` in your build directory.

[remix-vite]: ./vite
[pathless-layout-route]: ../file-conventions/routes#nested-layouts-without-nested-urls
