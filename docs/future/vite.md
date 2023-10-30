---
title: Vite (Unstable)
---

# Vite (Unstable)

<docs-warning>
  Vite support is currently unstable and only intended to gather early feedback.
  We don't yet recommend using this in production.
</docs-warning>

[Vite][vite] is a powerful, performant and extensible development environment for JavaScript projects. In order to improve and extend Remix's bundling capabilities, we're currently exploring the use of Vite as an alternative compiler to esbuild.

**Legend**: ✅ (Tested),❓ (Untested), ⏳ (Not Yet Supported)

| Feature                      | Node | Deno | Cloudflare | Notes                                                                 |
| ---------------------------- | ---- | ---- | ---------- | --------------------------------------------------------------------- |
| Built-in dev server          | ✅   | ❓   | ⏳         |                                                                       |
| Other servers (e.g. Express) | ✅   | ❓   | ⏳         |                                                                       |
| HMR                          | ✅   | ❓   | ⏳         |                                                                       |
| HDR                          | ✅   | ❓   | ⏳         |                                                                       |
| MDX routes                   | ✅   | ❓   | ⏳         | [Supported with some deprecations.][supported-with-some-deprecations] |

## Getting started

To get started with a minimal server, you can use the [`unstable-vite`][template-vite] template:

```shellscript nonumber
npx create-remix@nightly --template remix-run/remix/templates/unstable-vite
```

If you'd rather customize your server, you can use the [`unstable-vite-express`][template-vite-express] template:

```shellscript nonumber
npx create-remix@nightly --template remix-run/remix/templates/unstable-vite-express
```

These templates include a `vite.config.ts` file which is where the Remix Vite plugin is configured.

## Configuration

The Vite plugin does not use `remix.config.js`. Instead, the plugin directly accepts the following subset of Remix config options:

- [appDirectory][appdirectory]
- [assetsBuildDirectory][assetsbuilddirectory]
- [ignoredRouteFiles][ignoredroutefiles]
- [publicPath][publicpath]
- [routes][routes]
- [serverBuildPath][serverbuildpath]
- [serverModuleFormat][servermoduleformat]

For example, to configure `ignoredRouteFiles`:

```ts filename=vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
    }),
  ],
});
```

All other bundling-related options are now [configured with Vite][vite-config]. This means you have much greater control over the bundling process.

## Additional features & plugins

One of the reasons that Remix is moving to Vite is so you have less to learn when adopting Remix.
This means that, for any additional bundling features you'd like to use, you should reference [Vite documentation][vite] and the [Vite plugin community][vite-plugins] rather than the Remix documentation.

Vite has many [features][vite-features] and [plugins][vite-plugins] that are not built into the existing Remix compiler.
The use of any such features will render the existing Remix compiler unable to compile your app, so only use them if you intend to use Vite exclusively from here on out.

## Migrating

#### Setup Vite

👉 **Install Vite as a development dependency**

```shellscript nonumber
npm install -D vite
```

Remix is now just a Vite plugin, so you'll need to hook it up to Vite.

👉 **Replace `remix.config.js` with `vite.config.ts` at the root of your Remix app**

```ts filename=vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix()],
});
```

The subset of [supported Remix config options](#configuration) should be passed directly to the plugin:

```ts filename=vite.config.ts
export default defineConfig({
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
    }),
  ],
});
```

#### Update your server scripts

In development, Vite will lazily compile your app code on-demand, both for the server and the browser assets.
In production, Vite will handle bundling your app into client assets and a server bundle.

##### Migrating from Remix App Server

If you were using `remix-serve` in development (or `remix dev` without the `-c` flag), you'll need to switch to the new minimal dev server.
It comes built-in with the Remix Vite plugin and will take over when you run `vite dev`.

👉 **Update your `dev` and `build` scripts**

```json filename=package.json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build && vite build --ssr",
    "start": "remix-serve ./build/index.js"
  }
}
```

##### Migrating from a custom server

If you were using a custom server in development, you'll need to edit your custom server to use Vite's `connect` middleware.
This will delegate asset requests and initial render requests to Vite during development, letting you benefit from Vite's excellent DX even with a custom server.

Remix exposes APIs for exactly this purpose:

```ts
import {
  unstable_createViteServer, // provides middleware for handling asset requests
  unstable_loadViteServerBuild, // handles initial render requests
} from "@remix-run/dev";
```

For example, if you were using Express, here's how you could do it.

👉 **Update your `server.mjs` file**

```ts
import {
  unstable_createViteServer,
  unstable_loadViteServerBuild,
} from "@remix-run/dev";
import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import express from "express";

installGlobals();

const vite =
  process.env.NODE_ENV === "production"
    ? undefined
    : await unstable_createViteServer();

const app = express();

// handle asset requests
if (vite) {
  app.use(vite.middlewares);
} else {
  app.use(
    "/build",
    express.static("public/build", {
      immutable: true,
      maxAge: "1y",
    })
  );
}
app.use(express.static("public", { maxAge: "1h" }));

// handle SSR requests
app.all(
  "*",
  createRequestHandler({
    build: vite
      ? () => unstable_loadViteServerBuild(vite)
      : await import("./build/index.js"),
  })
);

const port = 3000;
app.listen(port, () =>
  console.log("http://localhost:" + port)
);
```

👉 **Update your `dev`, `build`, and `start` scripts**

```json filename=package.json
{
  "scripts": {
    "dev": "node ./server.mjs",
    "build": "vite build && vite build --ssr",
    "start": "cross-env NODE_ENV=production node ./server.mjs"
  }
}
```

If you prefer, you can instead author your custom server in TypeScript.
You could then use tools like [`tsx`][tsx] or [`tsm`][tsm] to run your custom server:

```shellscript nonumber
tsx ./server.tsx
node --loader tsm ./server.ts
```

Just remember that there might be some noticeable slowdown for initial server startup if you do this.

#### TypeScript integration

Vite handles imports for all sorts of different file types, sometimes in ways that differ from the existing Remix compiler, so let's reference Vite's types from `vite/client` instead of the obsolete types from `@remix-run/dev`.

👉 **Replace your `remix.env.d.ts` with a new `env.d.ts` file**

```ts filename=env.d.ts
/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />
```

👉 **Replace reference to `remix.env.d.ts` in `tsconfig.json`**

```diff filename=tsconfig.json
- "include": ["remix.env.d.ts", "**/*.ts", "**/*.tsx"],
+ "include": ["env.d.ts", "**/*.ts", "**/*.tsx"],
```

#### `LiveReload` before `Scripts`

<docs-info>
  This is a temporary workaround for a limitation that will be removed in the future.
</docs-info>

For React Fast Refresh to work, it [needs to be initialized before any app code is run][rfr-preamble].
That means it needs to come _before_ your `<Scripts />` element that loads your app code.

We're working on a better API that would eliminate issues with ordering scripts.
But for now, you can work around this limitation by manually moving `<LiveReload />` before `<Scripts />`.
If your app doesn't the `Scripts` component, you can safely ignore this step.

👉 **Ensure `<LiveReload />` comes _before_ `<Scripts />`**

```diff filename=app/root.tsx
export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
+        <LiveReload />
        <Scripts />
-        <LiveReload />
      </body>
    </html>
  );
}
```

#### Configure path aliases

The Remix compiler leverages the `paths` option in your `tsconfig.json` to resolve path aliases. This is commonly used in the Remix community to define `~` as an alias for the `app` directory.

Vite does not provide any path aliases by default. If you were relying on this feature, you can install the [vite-tsconfig-paths][vite-tsconfig-paths] plugin to automatically resolve path aliases from your `tsconfig.json` in Vite, matching the behavior of the Remix compiler:

👉 **Install `vite-tsconfig-paths`**

```shellscript nonumber
npm install -D vite-tsconfig-paths
```

👉 **Add `vite-tsconfig-paths` to your Vite config**

```ts filename=vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remix(), tsconfigPaths()],
});
```

#### Optionally remove `@remix-run/css-bundle`

Vite has built-in support for CSS side-effect imports, PostCSS and CSS Modules, among other CSS bundling features.

The Remix Vite plugin automatically attaches bundled CSS to the relevant routes so the <nobr>[`@remix-run/css-bundle`][css-bundling]</nobr> package can be removed if you only intend to use Vite in your project.

👉 **Remove references to `@remix-run/css-bundle`**

```diff filename=app/root.tsx
-import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

export const links: LinksFunction = () => [
-  ...(cssBundleHref
-    ? [{ rel: "stylesheet", href: cssBundleHref }]
-    : []),
  // ...
];
```

Of course, if this is the only style sheet for a given route, you can remove the links function entirely.

```diff filename=app/root.tsx
-import { cssBundleHref } from "@remix-run/css-bundle";
-import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

-export const links: LinksFunction = () => [
-  ...(cssBundleHref
-    ? [{ rel: "stylesheet", href: cssBundleHref }]
-    : []),
-];
```

#### Fix up CSS imports

Vite interprets CSS imports differently from the existing Remix compiler. If you want to get access to the `href` for a CSS file in Vite, you need to explicitly add `?url` to the end of your CSS import path.

```diff filename=app/dashboard/route.tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

-import dashboardStyles from "./dashboard.css";
+import dashboardStyles from "./dashboard.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: dashboardStyles },
];
```

**However, manually attaching CSS imports to link descriptors is now optional when using Vite!**

Instead, all CSS imports can now be side-effects.
The Remix Vite plugin will automatically attach these CSS files to the relevant routes.
This is more in line with how most Vite users manage CSS and means that in many cases you won't need the `links` function export anymore.

👉 **Convert CSS imports to side effects**

```diff filename=app/dashboard/route.tsx
// No need to export a links function anymore:
-import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

-import dashboardStyles from "./dashboard.css?url";

-export const links: LinksFunction = () => [
-  { rel: "stylesheet", href: dashboardStyles },
-];

// Just import the CSS as a side effect:
+import "./dashboard.css";
```

<docs-warning>If you're using PostCSS/Tailwind, you should **always** use CSS side-effect imports due to a [known issue with Vite when using `?url` with CSS imports and PostCSS.][vite-css-url-issue]</docs-warning>

#### Enable Tailwind via PostCSS

If your project is using Tailwind, you'll first need to ensure that you have a PostCSS config file which will get automatically picked up by Vite.
This is because the Remix compiler didn't require a PostCSS config file when Remix's `tailwind` option was enabled.

👉 **Add PostCSS config if it's missing, including the `tailwindcss` plugin**

```js filename=postcss.config.mjs
export default {
  plugins: {
    tailwindcss: {},
  },
};
```

If your project already has a PostCSS config file, you'll need to add the `tailwindcss` plugin if it's not already present.
This is because the Remix compiler included this plugin automatically when Remix's `tailwind` option was enabled.

👉 **Add the `tailwindcss` plugin to your PostCSS config if it's missing**

```js filename=postcss.config.mjs lines=[3]
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Due to a [known issue with Vite when using `?url` with CSS imports and PostCSS,][vite-css-url-issue] you should ensure that you're using a side-effect import for your Tailwind CSS file, otherwise the Tailwind styles won't be present in the production build.

👉 **Convert Tailwind CSS import to a side effect**

```diff filename=app/dashboard/route.tsx
// Don't export as a link descriptor:
-import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

-import tailwind from "./tailwind.css";

-export const links: LinksFunction = () => [
-  { rel: "stylesheet", href: tailwind },
-];

// Import as a side effect instead:
+import "./tailwind.css";
```

#### Add Vanilla Extract plugin

If you're using [Vanilla Extract][vanilla-extract], you'll need to set up the Vite plugin.

👉 **Install the official [Vanilla Extract plugin for Vite][vanilla-extract-vite-plugin]**

```shellscript nonumber
npm install -D @vanilla-extract/vite-plugin
```

👉 **Add the Vanilla Extract plugin to your Vite config**

```ts filename=vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix(), vanillaExtractPlugin()],
});
```

#### Add MDX plugin

If you're using MDX, since Vite's plugin API is an extension of the Rollup plugin API, you should use the official [MDX Rollup plugin][mdx-rollup-plugin]:

👉 **Install the MDX Rollup plugin**

```shellscript nonumber
npm install -D @mdx-js/rollup
```

👉 **Add the MDX Rollup plugin to your Vite config**

```ts filename=vite.config.ts
import mdx from "@mdx-js/rollup";
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix(), mdx()],
});
```

##### Add MDX frontmatter support

The Remix compiler allowed you to define [frontmatter in MDX][mdx-frontmatter]. If you were using this feature, you can achieve this in Vite using [remark-mdx-frontmatter].

👉 **Install the required [Remark][remark] frontmatter plugins**

```shellscript nonumber
npm install -D remark-frontmatter remark-mdx-frontmatter
```

👉 **Pass the Remark frontmatter plugins to the MDX Rollup plugin**

```ts filename=vite.config.ts
import mdx from "@mdx-js/rollup";
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix(),
    mdx({
      remarkPlugins: [
        remarkFrontmatter,
        remarkMdxFrontmatter,
      ],
    }),
  ],
});
```

In the Remix compiler, the frontmatter export was named `attributes`. This differs from the frontmatter plugin's default export name of `frontmatter`. Although it's possible to configure the frontmatter export name, we recommend updating your app code to use the default export name instead.

👉 **Rename MDX `attributes` export to `frontmatter` within MDX files**

```diff filename=app/posts/first-post.mdx
---
title: Hello, World!
---

-# {attributes.title}
+# {frontmatter.title}
```

👉 **Rename MDX `attributes` export to `frontmatter` for consumers**

```diff filename=app/routes/posts/first-post.tsx
import Component, {
-  attributes,
+  frontmatter,
} from "./posts/first-post.mdx";
```

###### Define types for MDX files

👉 **Add types for `*.mdx` files to `env.d.ts`**

```ts filename=env.d.ts lines=[4-8]
/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />

declare module "*.mdx" {
  let MDXComponent: (props: any) => JSX.Element;
  export const frontmatter: any;
  export default MDXComponent;
}
```

###### Map MDX frontmatter to route exports

The Remix compiler allowed you to define `headers`, `meta` and `handle` route exports in your frontmatter. This Remix-specific feature is obviously not supported by the `remark-mdx-frontmatter` plugin. If you were using this feature, you should manually map frontmatter to route exports yourself:

👉 **Map frontmatter to route exports for MDX routes**

```mdx lines=[10-11]
---
meta:
  - title: My First Post
  - name: description
    content: Isn't this awesome?
headers:
  Cache-Control: no-cache
---

export const meta = frontmatter.meta;
export const headers = frontmatter.headers;

# Hello World
```

Note that, since you're explicitly mapping MDX route exports, you're now free to use whatever frontmatter structure you like.

```mdx
---
title: My First Post
description: Isn't this awesome?
---

export const meta = () => {
  return [
    { title: frontmatter.title },
    {
      name: "description",
      content: frontmatter.description,
    },
  ];
};

# Hello World
```

###### Update MDX filename usage

The Remix compiler also provided a `filename` export from all MDX files. This was primarily designed to enable linking to collections of MDX routes. If you were using this feature, you can achieve this in Vite via [glob imports][glob-imports] which give you a handy data structure that maps file names to modules. This makes it much easier to maintain a list of MDX files since you no longer need to import each one manually.

For example, to import all MDX files in the `posts` directory:

```ts
const posts = import.meta.glob("./posts/*.mdx");
```

This is equivalent to writing this by hand:

```ts
const posts = {
  "./posts/a.mdx": () => import("./posts/a.mdx"),
  "./posts/b.mdx": () => import("./posts/b.mdx"),
  "./posts/c.mdx": () => import("./posts/c.mdx"),
  // etc.
};
```

You can also eagerly import all MDX files if you'd prefer:

```ts
const posts = import.meta.glob("./posts/*.mdx", {
  eager: true,
});
```

## Troubleshooting

Check out the [known issues with the Remix Vite plugin on GitHub][issues-vite] before filing a new bug report!

#### HMR

If you are expecting hot updates but getting full page reloads,
check out our [discussion on Hot Module Replacement][hmr] to learn more about the limitations of React Fast Refresh and workarounds for common issues.

#### Server code not treeshaken in development

In production, Vite treeshakes server-only code from your client bundle, just like the existing Remix compiler.
However, in development, Vite lazily compiles each module on-demand and therefore _does not_ treeshake across module boundaries.

If you run into browser errors in development that reference server-only code, be sure to place that [server-only code in a `.server` file][server-only-code].

At first, this might seem like a compromise for DX when compared to the existing Remix compiler, but the mental model is simpler: `.server` is for server-only code, everything else could be on both the client and the server.

## Acknowledgements

Vite is an amazing project and we're grateful to the Vite team for their work.
Special thanks to [Matias Capeletto, Arnaud Barré, and Bjorn Lu from the Vite team][vite-team] for their guidance.

The Remix community was quick to explore Vite support and we're grateful for their contributions:

- [Discussion: Consider using Vite][consider-using-vite]
- [remix-kit][remix-kit]
- [remix-vite][remix-vite]
- [vite-plugin-remix][vite-plugin-remix]

Finally, we were inspired by how other frameworks implemented Vite support:

- [Astro][astro]
- [SolidStart][solidstart]
- [SvelteKit][sveltekit]

We're definitely late to the Vite party, but we're excited to be here now!

[vite]: https://vitejs.dev
[create-remix]: ../other-api/create-remix
[remix_config]: ../file-conventions/remix-config
[appdirectory]: ../file-conventions/remix-config#appdirectory
[assetsbuilddirectory]: ../file-conventions/remix-config#assetsbuilddirectory
[ignoredroutefiles]: ../file-conventions/remix-config#ignoredroutefiles
[publicpath]: ../file-conventions/remix-config#publicpath
[routes]: ../file-conventions/remix-config#routes
[serverbuildpath]: ../file-conventions/remix-config#serverbuildpath
[servermoduleformat]: ../file-conventions/remix-config#servermoduleformat
[vite-config]: https://vitejs.dev/config
[vite-features]: https://vitejs.dev/guide/features.html
[vite-plugins]: https://vitejs.dev/plugins
[vite-tsconfig-paths]: https://github.com/aleclarson/vite-tsconfig-paths
[vite-resolve-alias]: https://vitejs.dev/config/shared-options.html#resolve-alias
[css-bundling]: ../styling/bundling
[tailwind]: https://tailwindcss.com
[tailwind-postcss]: https://tailwindcss.com/docs/installation/using-postcss
[vanilla-extract]: https://vanilla-extract.style
[vanilla-extract-vite-plugin]: https://vanilla-extract.style/documentation/integrations/vite
[mdx-rollup-plugin]: https://mdxjs.com/packages/rollup
[mdx-frontmatter]: https://mdxjs.com/guides/frontmatter
[remark]: https://remark.js.org
[remark-mdx-frontmatter]: https://github.com/remcohaszing/remark-mdx-frontmatter
[glob-imports]: https://vitejs.dev/guide/features.html#glob-import
[vite-team]: https://vitejs.dev/team.html
[consider-using-vite]: https://github.com/remix-run/remix/discussions/2427
[remix-kit]: https://github.com/jrestall/remix-kit
[remix-vite]: https://github.com/sudomf/remix-vite
[vite-plugin-remix]: https://github.com/yracnet/vite-plugin-remix
[astro]: https://astro.build/
[solidstart]: https://start.solidjs.com/getting-started/what-is-solidstart
[sveltekit]: https://kit.svelte.dev/
[supported-with-some-deprecations]: #mdx
[rfr-preamble]: https://github.com/facebook/react/issues/16604#issuecomment-528663101
[component-keys]: #component-keys
[issues-vite]: https://github.com/remix-run/remix/labels/vite
[hmr]: ../discussion/hot-module-replacement
[template-vite]: https://github.com/remix-run/remix/tree/main/templates/unstable-vite
[template-vite-express]: https://github.com/remix-run/remix/tree/main/templates/unstable-vite-express
[server-only-code]: https://remix.run/docs/en/main/guides/gotchas#server-code-in-client-bundles
[tsx]: https://github.com/esbuild-kit/tsx
[tsm]: https://github.com/lukeed/tsm
[vite-css-url-issue]: https://github.com/vitejs/vite/issues/13416
