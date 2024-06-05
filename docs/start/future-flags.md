---
title: Future Flags
order: 5
---

# Future Flags

The following future flags are stable and ready to adopt. To read more about future flags see [Development Strategy][development-strategy]

## Update to latest v2.x

First update to the latest minor version of v2.x to have the latest future flags.

👉 **Update to latest v2**

```shellscript nonumber
npm install @remix-run/{dev,react,node,etc.}@2
```

## Vite Plugin

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

👉 **Install global Node polyfills in your Vite config**

```diff filename=vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
+import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";

+installGlobals();

export default defineConfig({
  plugins: [remix()],
});
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

```ts
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

```ts
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

```ts
remix({
  future: {
    v3_throwAbortReason: true,
  },
});
```

**Update your Code**

You likely won't need to adjust any code, unless you had custom logic inside of `handleError` that was matching the previous error message to differentiate it from other errors.

[development-strategy]: ../guides/api-development-strategy
[fetcherpersist-rfc]: https://github.com/remix-run/remix/discussions/7698
[use-fetchers]: ../hooks/use-fetchers
[use-fetcher]: ../hooks/use-fetcher
[relativesplatpath-changelog]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#futurev3_relativesplatpath
[single-fetch]: ../guides/single-fetch
[vite]: https://vitejs.dev
[vite-docs]: ../guides/vite
[vite-blog-post]: https://remix.run/blog/remix-vite-stable
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
