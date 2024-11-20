---
title: Future Flags
order: 5
---

# Future Flags and Deprecations

This guide walks you through the process of adopting future flags in your Remix app. By following this strategy, you will be able to upgrade to the next major version of Remix with minimal changes. To read more about future flags see [Development Strategy][development-strategy].

We highly recommend you make a commit after each step and ship it instead of doing everything all at once. Most flags can be adopted in any order, with exceptions noted below.

## Update to latest v2.x

First update to the latest minor version of v2.x to have the latest future flags. You will likely see a number of deprecation warnings as you upgrade, which we'll cover below.

👉 **Update to latest v2**

```shellscript nonumber
npm install @remix-run/{dev,react,node,etc.}@2
```

## Remove `installGlobals`

**Background**

Previously Remix required a `fetch` polyfill to be installed. This was accomplished by calling `installGlobals()`.

The next major version requires a minimum of Node 20 to take advantage of the built-in `fetch` support.

Note: if you are using miniflare/cloudflare worker with your remix project, ensure your [compatibility flag][compatibility-flag] is set to `2023-03-01` or later as well.

👉 **Update to Node 20+**

It is recommended that you upgrade to the latest even-numbered version of Node LTS.

👉 **Remove `installGlobals`**

```diff filename=vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

-installGlobals();

export default defineConfig({
  plugins: [remix()],
});
```

## Adopt the Vite Plugin

**Background**

Remix no longer uses its own, closed compiler (now referred to as the "Classic Compiler"), and instead uses [Vite][vite]. Vite is a powerful, performant and extensible development environment for JavaScript projects. [View the Vite docs][vite-docs] for more information on performance, troubleshooting, etc.

While this is not a future flag, new features and some feature flags are only available in the Vite plugin, and the Classic Compiler will be removed in the next version of Remix.

👉 **Install Vite**

```shellscript nonumber
npm install -D vite
```

**Update your Code**

👉 **Replace `remix.config.js` with `vite.config.ts` at the root of your Remix app**

```ts filename=vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix()],
});
```

The subset of [supported Remix config options][supported-remix-config-options] should be passed directly to the plugin:

```ts filename=vite.config.ts lines=[3-5]
export default defineConfig({
  plugins: [
    remix({
      ignoredRouteFiles: ["**/*.css"],
    }),
  ],
});
```

👉 **Add `unstable_optimizeDeps` (optional)**

Many users found that automatically [optimizing dependencies][dependency-optimization] helped them more easily adopt the Vite plugin. For this reason we added the `unstable_optimizeDeps` flag to the Vite plugin.

This flag will remain in an "unstable" state until React Router v7 so it is not critical that you adopt this in your Remix v2 app prior to upgrading to React Router v7.

```ts filename=vite.config.ts lines=[4-6]
export default defineConfig({
  plugins: [
    remix({
      future: {
        unstable_optimizeDeps: true,
      },
    }),
  ],
});
```

👉 **Remove `<LiveReload/>`, keep `<Scripts />`**

```diff
  import {
-   LiveReload,
    Outlet,
    Scripts,
  }

  export default function App() {
    return (
      <html>
        <head>
        </head>
        <body>
          <Outlet />
-         <LiveReload />
          <Scripts />
        </body>
      </html>
    )
  }
```

👉 **Update `tsconfig.json`**

Update the `types` field in `tsconfig.json` and make sure `skipLibCheck`, `module`, and `moduleResolution` are all set correctly.

```json filename=tsconfig.json lines=[3-6]
{
  "compilerOptions": {
    "types": ["@remix-run/node", "vite/client"],
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

👉 **Update/remove `remix.env.d.ts`**

Remove the following type declarations in `remix.env.d.ts`

```diff filename=remix.env.d.ts
- /// <reference types="@remix-run/dev" />
- /// <reference types="@remix-run/node" />
```

If `remix.env.d.ts` is now empty, delete it

```shellscript nonumber
rm remix.env.d.ts
```

**Configure path aliases**

Vite does not provide any path aliases by default. If you were relying on this feature, such as defining `~` as an alias for the `app` directory, you can install the [vite-tsconfig-paths][vite-tsconfig-paths] plugin to automatically resolve path aliases from your `tsconfig.json` in Vite, matching the behavior of the Remix compiler:

👉 **Install `vite-tsconfig-paths`**

```shellscript nonumber
npm install -D vite-tsconfig-paths
```

👉 **Add `vite-tsconfig-paths` to your Vite config**

```ts filename=vite.config.ts lines=[3,6]
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remix(), tsconfigPaths()],
});
```

**Remove `@remix-run/css-bundle`**

Vite has built-in support for CSS side effect imports, PostCSS and CSS Modules, among other CSS bundling features. The Remix Vite plugin automatically attaches bundled CSS to the relevant routes.

The <nobr>[`@remix-run/css-bundle`][css-bundling]</nobr> package is redundant when using Vite since its `cssBundleHref` export will always be `undefined`.

👉 **Uninstall `@remix-run/css-bundle`**

```shellscript nonumber
npm uninstall @remix-run/css-bundle
```

👉 **Remove references to `cssBundleHref`**

```diff filename=app/root.tsx
- import { cssBundleHref } from "@remix-run/css-bundle";
  import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

  export const links: LinksFunction = () => [
-   ...(cssBundleHref
-     ? [{ rel: "stylesheet", href: cssBundleHref }]
-     : []),
    // ...
  ];
```

**Fix up CSS imports referenced in `links`**

If you are [referencing CSS in a `links` function][regular-css], you'll need to update the corresponding CSS imports to use [Vite's explicit `?url` import syntax.][vite-url-imports]

👉 **Add `?url` to CSS imports used in `links`**

```diff
-import styles from "~/styles/dashboard.css";
+import styles from "~/styles/dashboard.css?url";

export const links = () => {
  return [
    { rel: "stylesheet", href: styles }
  ];
}
```

**Migrate Tailwind CSS or Vanilla Extract**

If you are using Tailwind CSS or Vanilla Extract, see the [full migration guide][migrate-css-frameworks].

**Migrate from Remix App Server**

👉 **Update your `dev`, `build` and `start` scripts**

```json filename=package.json lines=[3-5]
{
  "scripts": {
    "dev": "remix vite:dev",
    "build": "remix vite:build",
    "start": "remix-serve ./build/server/index.js"
  }
}
```

👉 **Configure your Vite dev server port (optional)**

```js filename=vite.config.ts lines=[2-4]
export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [remix()],
});
```

**Migrate a custom server**

If you are migrating a customer server or Cloudflare Functions, see the [full migration guide][migrate-a-custom-server].

**Migrate MDX routes**

If you're using [MDX][mdx], you should use the official [MDX Rollup plugin][mdx-rollup-plugin]. See the [full migration guide][migrate-mdx] for a step-by-step walkthrough.

## v3_fetcherPersist

**Background**

The fetcher lifecycle is now based on when it returns to an idle state rather than when its owner component unmounts: [View the RFC][fetcherpersist-rfc] for more information.

👉 **Enable the Flag**

```ts filename=vite.config.ts
remix({
  future: {
    v3_fetcherPersist: true,
  },
});
```

**Update your Code**

It's unlikely to affect your app. You may want to check any usage of `useFetchers` as they may persist longer than they did before. Depending on what you're doing, you may render something longer than before.

## v3_relativeSplatPath

**Background**

Changes the relative path matching and linking for multi-segment splats paths like `dashboard/*` (vs. just `*`). [View the CHANGELOG][relativesplatpath-changelog] for more information.

👉 **Enable the Flag**

```ts filename=vite.config.ts
remix({
  future: {
    v3_relativeSplatPath: true,
  },
});
```

**Update your Code**

If you have any routes with a path + a splat like `dashboard.$.tsx` or `route("dashboard/*")` that have relative links like `<Link to="relative">` or `<Link to="../relative">` beneath it, you will need to update your code.

👉 **Split the route into two**

For any splat routes split it into a layout route and a child route with the splat:

```diff

└── routes
    ├── _index.tsx
+   ├── dashboard.tsx
    └── dashboard.$.tsx

// or
routes(defineRoutes) {
  return defineRoutes((route) => {
    route("/", "home/route.tsx", { index: true });
-    route("dashboard/*", "dashboard/route.tsx")
+    route("dashboard", "dashboard/layout.tsx", () => {
+      route("*", "dashboard/route.tsx");
    });
  });
},
```

👉 **Update relative links**

Update any `<Link>` elements with relative links within that route tree to include the extra `..` relative segment to continue linking to the same place:

```diff
// dashboard.$.tsx or dashboard/route.tsx
function Dashboard() {
  return (
    <div>
      <h2>Dashboard</h2>
      <nav>
-        <Link to="">Dashboard Home</Link>
-        <Link to="team">Team</Link>
-        <Link to="projects">Projects</Link>
+        <Link to="../">Dashboard Home</Link>
+        <Link to="../team">Team</Link>
+        <Link to="../projects">Projects</Link>
      </nav>
    </div>
  );
}
```

## v3_throwAbortReason

**Background**

When a server-side request is aborted, such as when a user navigates away from a page before the loader finishes, Remix will throw the `request.signal.reason` instead of an error such as `new Error("query() call aborted...")`.

👉 **Enable the Flag**

```ts filename=vite.config.ts
remix({
  future: {
    v3_throwAbortReason: true,
  },
});
```

**Update your Code**

You likely won't need to adjust any code, unless you had custom logic inside of `handleError` that was matching the previous error message to differentiate it from other errors.

## v3_lazyRouteDiscovery

**Background**

With this flag, Remix no longer sends the full route manifest up to the client on initial load. Instead, Remix only sends the server-rendered routes up in the manifest and then fetches the remaining routes as the user navigated around the application. Additional details are available in the [docs][lazy-route-discovery] and the [blog post][lazy-route-discovery-blog-post]

👉 **Enable the Flag**

```ts filename=vite.config.ts
remix({
  future: {
    v3_lazyRouteDiscovery: true,
  },
});
```

**Update your Code**

You shouldn't need to make any changes to your application code for this feature to work.

You may find some usage for the new [`<Link discover>`][discover-prop] API if you wish to disable eager route discovery on certain links.

## v3_singleFetch

<docs-warning>

This flag requires the [Vite plugin][vite-plugin].

</docs-warning>

**Background**

With this flag, Remix uses a single fetch for data requests during client-side navigations. This simplifies data loading by treating data requests the same as document requests, eliminating the need to handle headers and caching differently. For advanced use cases, you can still opt into fine-grained revalidations. View the ["Single Fetch" docs][single-fetch] for more information.

👉 **Enable the Flag (and the types)**

```ts filename=vite.config.ts lines=[5-10,16]
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

declare module "@remix-run/node" {
  // or cloudflare, deno, etc.
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_singleFetch: true,
      },
    }),
    tsconfigPaths(),
  ],
});
```

**Update your Code**

You should be able to mostly use your code as-is with the flag enabled, but the following changes should be made over time and will be required prior to the next major version.

👉 **Remove `json()`/`defer()` in favor of raw objects**

Single Fetch supports JSON objects and Promises out of the box, so you can return the raw data from your `loader`/`action` functions:

```diff
-import { json } from "@remix-run/node";

export async function loader({}: LoaderFunctionArgs) {
  let tasks = await fetchTasks();
- return json(tasks);
+ return tasks;
}
```

```diff
-import { defer } from "@remix-run/node";

export async function loader({}: LoaderFunctionArgs) {
  let lazyStuff = fetchLazyStuff();
  let tasks = await fetchTasks();
- return defer({ tasks, lazyStuff });
+ return { tasks, lazyStuff };
}
```

If you were using the second parameter of `json`/`defer` to set a custom status or headers on your response, you can continue doing do via the new `data` API:

```diff
-import { json } from "@remix-run/node";
+import { data } from "@remix-run/node";

export async function loader({}: LoaderFunctionArgs) {
  let tasks = await fetchTasks();
-  return json(tasks, {
+  return data(tasks, {
    headers: {
      "Cache-Control": "public, max-age=604800"
    }
  });
}
```

👉 **Adjust your server abort delay**

If you were using a custom `ABORT_DELAY` in your `entry.server.tsx` file, you should change that to use thew new `streamTimeout` API leveraged by Single Fetch:

```diff filename=entry.server.tsx
-const ABORT_DELAY = 5000;
+// Reject/cancel all pending promises after 5 seconds
+export const streamTimeout = 5000;

// ...

function handleBrowserRequest(/* ... */) {
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
-        abortDelay={ABORT_DELAY}
      />,
      {
        onShellReady() {
          /* ... */
        },
        onShellError(error: unknown) {
          /* ... */
        },
        onError(error: unknown) {
          /* ... */
        },
      }
    );

-    setTimeout(abort, ABORT_DELAY);
+   // Automatically timeout the React renderer after 6 seconds, which ensures
+   // React has enough time to flush down the rejected boundary contents
+   setTimeout(abort, streamTimeout + 1000);
  });
}
```

## unstable_routeConfig

<docs-warning>

This flag requires the [Vite plugin][vite-plugin].

</docs-warning>

Config-based routing is the new default in React Router v7, configured via the `routes.ts` file in the app directory. Support for `routes.ts` and its related APIs in Remix are designed as a migration path to help minimize the number of changes required when moving your Remix project over to React Router v7. While some new packages have been introduced within the `@remix-run` scope, these new packages only exist to keep the code in `routes.ts` as similar as possible to the equivalent code for React Router v7.

When the `unstable_routeConfig` future flag is enabled, Remix's built-in file system routing will be disabled and your project will opted into React Router v7's config-based routing. If you prefer to keep using Remix's file-based routing we cover how to enable it in `routes.ts` below.

**Update your code**

To migrate Remix's file system routing and route config to the equivalent setup in React Router v7, you can follow these steps:

👉 **Enable the Flag**

```ts filename=vite.config.ts
remix({
  future: {
    unstable_routeConfig: true,
  },
});
```

👉 **Install `@remix-run/route-config`**

This package matches the API of React Router v7's `@react-router/dev/routes`, making the React Router v7 migration as easy as possible.

```shellscript nonumber
npm install -D @remix-run/route-config
```

This provides the core `RouteConfig` type as well as a set of helpers for configuring routes in code.

👉 **Add an `app/routes.ts` file without any configured routes**

```shellscript nonumber
touch app/routes.ts
```

```ts filename=app/routes.ts
import type { RouteConfig } from "@remix-run/route-config";

export const routes: RouteConfig = [];
```

This is a good way to check that your new `routes.ts` file is being picked up successfully. Your app should now be rendering a blank page since there aren't any routes defined yet.

👉 **Install `@remix-run/fs-routes` and use it in `routes.ts`**

```shellscript nonumber
npm install -D @remix-run/fs-routes
```

This package matches the API of React Router v7's `@react-router/fs-routes`, making the React Router v7 migration as easy as possible.

> If you've configured `ignoredRouteFiles` to `["**/*"]`, you should skip this step since you're already opting out of Remix's file system routing.

```ts filename=app/routes.ts
import { flatRoutes } from "@remix-run/fs-routes";
import type { RouteConfig } from "@remix-run/route-config";

export const routes: RouteConfig = flatRoutes();
```

👉 **If you used the `routes` config option, add `@remix-run/routes-option-adapter` and use it in `routes.ts`**

Remix provides a mechanism for defining routes in code and plugging in alternative file system routing conventions, available via the `routes` option on the Vite plugin.

To make migration easier, an adapter package is available that converts Remix's `routes` option into React Router's `RouteConfig` array.

To get started, first install the adapter:

```shellscript nonumber
npm install -D @remix-run/routes-option-adapter
```

This package matches the API of React Router v7's `@react-router/remix-routes-option-adapter`, making the React Router v7 migration as easy as possible.

Then, update your `routes.ts` file to use the adapter, passing the value of your `routes` option to the `remixRoutesOptionAdapter` function which will return an array of configured routes.

For example, if you were using the `routes` option to use an alternative file system routing implementation like [remix-flat-routes]:

```ts filename=app/routes.ts
import { type RouteConfig } from "@remix-run/route-config";
import { remixRoutesOptionAdapter } from "@remix-run/routes-option-adapter";
import { flatRoutes } from "remix-flat-routes";

export const routes: RouteConfig = remixRoutesOptionAdapter(
  (defineRoutes) => flatRoutes("routes", defineRoutes)
);
```

Or, if you were using the `routes` option to define config-based routes:

```ts filename=app/routes.ts
import { flatRoutes } from "@remix-run/fs-routes";
import { type RouteConfig } from "@remix-run/route-config";
import { remixRoutesOptionAdapter } from "@remix-run/routes-option-adapter";

export const routes: RouteConfig = remixRoutesOptionAdapter(
  (defineRoutes) => {
    return defineRoutes((route) => {
      route("/", "home/route.tsx", { index: true });
      route("about", "about/route.tsx");
      route("", "concerts/layout.tsx", () => {
        route("trending", "concerts/trending.tsx");
        route(":city", "concerts/city.tsx");
      });
    });
  }
);
```

If you're defining config-based routes in this way, you might want to consider migrating to the new route config API since it's more streamlined while still being very similar to the old API. For example, the routes above would look like this:

```ts
import {
  type RouteConfig,
  route,
  layout,
  index,
} from "@remix-run/route-config";

export const routes: RouteConfig = [
  index("home/route.tsx"),
  route("about", "about/route.tsx"),
  layout("concerts/layout.tsx", [
    route("trending", "concerts/trending.tsx"),
    route(":city", "concerts/city.tsx"),
  ]),
];
```

Note that if you need to mix and match different route config approaches, they can be merged together into a single array of routes. The `RouteConfig` type ensures that everything is still valid.

```ts
import { flatRoutes } from "@remix-run/fs-routes";
import type { RouteConfig } from "@remix-run/route-config";
import { route } from "@remix-run/route-config";
import { remixRoutesOptionAdapter } from "@remix-run/routes-option-adapter";

export const routes: RouteConfig = [
  ...(await flatRoutes({ rootDirectory: "fs-routes" })),

  ...(await remixRoutesOptionAdapter(/* ... */)),

  route("/hello", "routes/hello.tsx"),
];
```

## Deprecations

### @remix-run/eslint-config

The `@remix-run/eslint-config` package is deprecated and will not be included in React Router v7. We recommend moving towards a streamlined ESLint config such as the ones included in [the Remix templates][remix-template-eslint-config].

### json

This utility is deprecated and will be removed in React Router v7 in favor of [Single Fetch][v3_singlefetch] naked object returns.

- If you were not relying on `json` to serialize your data (such as stringifying `Date` objects), you can safely remove it.
- If you were returning `headers` or `status` via `json`, you can use the new [data util][data-api] as a drop-in replacement to set those values.
- If you want to serialize your data to JSON, you can use the native [Response.json()][response-json] method.

View the [Single Fetch][v3_singlefetch] docs for more information.

### defer

This utility is deprecated and will be removed in React Router v7 in favor of [Single Fetch][v3_singlefetch] naked object returns.

- If you were returning `headers` or `status` via `defer`, you can use the new [data util][data-api] as a drop-in replacement to set those values.

View the [Single Fetch][v3_singlefetch] docs for more information.

### SerializeFrom

This type is deprecated and will be removed in React Router v7 since [Single Fetch][v3_singlefetch] no longer serializes data to JSON.

If you are relying on `SerializeFrom` to unwrap your `loader`/`action` data, you can use a custom type like this:

```ts
type SerializeFrom<T> = ReturnType<typeof useLoaderData<T>>;
```

In most cases, you should be able to just remove `SerializeFrom` and use the types returned from `useLoaderData`/`useActionData`, or the types of the data in `loader`/`action` functions.

[development-strategy]: ../guides/api-development-strategy
[fetcherpersist-rfc]: https://github.com/remix-run/remix/discussions/7698
[relativesplatpath-changelog]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#futurev3_relativesplatpath
[single-fetch]: ../guides/single-fetch
[lazy-route-discovery]: ../guides/lazy-route-discovery
[lazy-route-discovery-blog-post]: https://remix.run/blog/fog-of-war
[discover-prop]: ../components/link#discover
[vite]: https://vitejs.dev
[vite-docs]: ../guides/vite
[supported-remix-config-options]: ../file-conventions/vite-config
[migrate-css-frameworks]: ../guides/vite#enable-tailwind-via-postcss
[migrate-a-custom-server]: ../guides/vite#migrating-a-custom-server
[migrate-mdx]: ../guides/vite#add-mdx-plugin
[vite-tsconfig-paths]: https://github.com/aleclarson/vite-tsconfig-paths
[css-bundling]: ../styling/bundling
[regular-css]: ../styling/css
[vite-url-imports]: https://vitejs.dev/guide/assets.html#explicit-url-imports
[mdx]: https://mdxjs.com
[mdx-rollup-plugin]: https://mdxjs.com/packages/rollup
[remix-flat-routes]: https://github.com/kiliman/remix-flat-routes
[dependency-optimization]: ../guides/dependency-optimization
[compatibility-flag]: https://developers.cloudflare.com/workers/configuration/compatibility-dates
[vite-plugin]: #adopt-the-vite-plugin
[v3_singlefetch]: #v3_singlefetch
[data-api]: ../utils/data
[response-json]: https://developer.mozilla.org/en-US/docs/Web/API/Response/json
[remix-template-eslint-config]: https://github.com/remix-run/remix/blob/main/templates/remix/.eslintrc.cjs
