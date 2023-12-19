---
title: Server Bundles (Unstable)
---

# Server Bundles (Unstable)

<docs-warning>This is an advanced feature designed for hosting provider integrations. When a Remix app is compiled into multiple request handlers, there will need to be a custom routing layer in front of your app directing requests to the correct handler. Hosting providers that want to make use of this feature are expected to implement this custom routing layer, not the average Remix developer. This feature is currently unstable and only designed to gather early feedback.</docs-warning>

Remix typically builds your server code into a single request handler function. However, there are some scenarios where you might want to split your route tree into multiple request handlers that each accept a subset of requests. To provide this level of flexibility, the [Remix Vite plugin][remix-vite] supports an `unstable_serverBundles` option which is a function for assigning routes to different server bundles.

The provided `unstable_serverBundles` function is called for each route in the tree (except for routes that aren't addressable, e.g. pathless layout routes) and returns a server bundle ID that you'd like to assign it to. These bundle IDs will be used as directory names in your server build directory.

The function is passed a route `branch` which is a root-first array of `route` objects leading to and including the target route which which allows you to create server bundles for different portions of the route tree. For example, you could use this to create a server bundle containing all routes within a particular layout route:

```ts filename=vite.config.ts lines=[7-10]
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      unstable_serverBundles: ({ branch }) => {
        const isAuthenticatedRoute = branch.some(
          (route) => route.id === "routes/_authenticated"
        );

        return isAuthenticatedRoute
          ? "authenticated"
          : "unauthenticated";
      },
    }),
  ],
});
```

Each `route` object in the `branch` array contains the following properties:

- `id` — The unique ID for this route, named like its `file` but relative to the app directory and without the extension, e.g. `app/routes/gists.$username.tsx` will have an `id` of `routes/gists.$username`.
- `path` — The path this route uses to match on the URL pathname.
- `file` — The absolute path to the entry point for this route.
- `index` — Whether or not this route is an index route.
- `caseSensitive` — Whether or not the `path` is case-sensitive.
- `parentId` — The unique `id` for this route's parent route, if there is one.

## Server bundle manifest

When the build is complete, Remix will generate a `bundles.json` manifest file in your server build directory containing an object with the following properties:

- `serverBundles` — An object mapping bundle IDs to an object containing the bundle's `id` and `file`.
- `routeIdToServerBundleId` — An object mapping route IDs to server bundle ID.
- `routes` — A route manifest mapping route IDs to route metadata. This can be used to drive a custom routing layer in front of your Remix request handlers.

[remix-vite]: ./vite.md
[pathless-layout-route]: ../file-conventions/routes#nested-layouts-without-nested-urls
