---
title: Vite (Unstable)
toc: false
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

## Configuration

The Vite plugin accepts the following subset of Remix config options:

<docs-warning>
  Note that `remix.config.js` is not used by the Remix Vite plugin unless you manually import it in your Vite config and pass it to the plugin.
</docs-warning>

- [appDirectory][appdirectory]
- [assetsBuildDirectory][assetsbuilddirectory]
- [ignoredRouteFiles][ignoredroutefiles]
- [publicPath][publicpath]
- [routes][routes]
- [serverBuildPath][serverbuildpath]
- [serverModuleFormat][servermoduleformat]

For example:

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

## Migrating

### Setup Vite

👉 Install Vite as a development dependency:

```shellscript nonumber
npm install -D vite
```

Remix is now just a Vite plugin, so you'll need to hook it up to Vite.

👉 Create a `vite.config.ts` at the root of your Remix app:

```ts filename=vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix()],
});
```

### Update your server scripts

In development, Vite will lazily compile your app code on-demand, both for the server and the browser assets.
In production, Vite will handle bundling your app into client assets and a server bundle.

#### Migrating from Remix App Server

If you were using `remix-serve` in development (or `remix dev` without the `-c` flag), you'll need to switch to the new minimal dev server.
It comes built-in with the Remix Vite plugin and will take over when you run `vite dev`.

👉 Update your `dev` and `build` scripts:

```json filename=package.json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build && vite build --ssr",
    "start": "remix-serve ./build/index.js"
  }
}
```

#### Migrating from a custom server

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

👉 Update your `server.mjs` file:

```ts
import {
  unstable_createViteServer,
  unstable_loadViteServerBuild,
} from "@remix-run/dev";
import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import express from "express";

installGlobals();

let vite =
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

👉 Update your `dev`, `build`, and `start` scripts:

```json filename=package.json
{
  "scripts": {
    "dev": "node ./server.mjs",
    "build": "vite build && vite build --ssr",
    "start": "cross-env NODE_ENV=production node ./server.mjs"
  }
}
```

<docs-info>
  If you prefer, you can author your custom server in TypeScript.
  You could then use tools like [`tsx`][tsx] or [`node --loader tsm`][tsm] to run your custom server.
  Just remember that there might be some noticeable slowdown for initial server startup if you do this.
</docs-info>

### Setup TS types

Vite now handles imports for all sorts of different file types, so let's use those instead of the obsolete Remix compiler types.

👉 Replace your `remix.env.d.ts` with a new `env.d.ts` file:

```diff filename=env.d.ts
- /// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />
+ /// <reference types="vite/client" />
```

### `LiveReload` before `Scripts`

<docs-info>
  This is a temporary workaround for a limitation that will be removed in the future.
</docs-info>

For React Fast Refresh to work, it [needs to be initialized before any app code is run][rfr-preamble].
That means it needs to come _before_ your `<Scripts />` component that loads your app code.

We're working on a better API that would eliminate issues with ordering scripts.
But for now, you can work around this limitation by manually moving `LiveReload` before `Scripts`.
If your app doesn't use `Scripts`, you can safely ignore this step.

👉 Ensure `LiveReload` comes _before_ `Scripts`:

```diff
// app/root.tsx

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

## Additional features via plugins

Vite has many [features][vite-features] and [plugins][vite-plugins] that are not built into the existing Remix compiler.
Using any such features means will render the existing Remix compiler unable to compile your app, so only use them if you intend to use Vite exclusively from here on out.

### Path Aliases

The Remix compiler leverages the `paths` option in your `tsconfig.json` to resolve path aliases. This is commonly used in the Remix community to define `~` as an alias for the `app` directory.

Vite does not provide any path aliases by default. You can install the [vite-tsconfig-paths][vite-tsconfig-paths] plugin to automatically resolve path aliases from your `tsconfig.json` in Vite, matching the behavior of the Remix compiler:

```shellscript nonumber
npm install -D vite-tsconfig-paths
```

Then add it to your Vite config:

```ts filename=vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remix(), tsconfigPaths()],
});
```

Alternatively, you can define path aliases without referencing `tsconfig.json` by using Vite's [`resolve.alias`][vite-resolve-alias] option directly:

```ts filename=vite.config.ts
import { fileURLToPath, URL } from "node:url";

import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  plugins: [remix()],
});
```

### Styling & CSS

#### Regular CSS Imports

When importing a CSS file in Vite, its default export is its file contents as a string. This differs from the Remix compiler which provides the file's URL. To import the URL of a CSS file in Vite, you'll need to explicitly add `?url` to the end of the import path:

```diff
-import styles from "./styles.css";
+import styles from "./styles.css?url";
```

For example:

```ts filename=app/dashboard/route.tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import styles from "./dashboard.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];
```

If you're using Vite and the Remix compiler in the same project, you can enable `legacyCssImports` in the Remix Vite plugin which will automatically append `?url` to all relevant CSS imports:

<docs-info>This option is only intended for use during the transition to Vite and will be removed in the future.</docs-info>

```ts filename=vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      legacyCssImports: true,
    }),
  ],
});
```

#### CSS Bundling

Vite has built-in support for CSS side-effect imports, PostCSS and CSS Modules, among other CSS bundling features. The Remix Vite plugin automatically attaches bundled CSS to the relevant routes so the [`@remix-run/css-bundle`][css-bundling] package is no longer required.

If you're using Vite and the Remix compiler in the same project, you can continue to use `@remix-run/css-bundle` as long as you check for the existence of `cssBundleHref` before using it:

```ts
import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

export const links: LinksFunction = () => [
  ...(cssBundleHref
    ? [{ rel: "stylesheet", href: cssBundleHref }]
    : []),
  // ...
];
```

#### Tailwind

To use [Tailwind][tailwind] in Vite, first install the required dependencies:

```shellscript nonumber
npm install -D tailwindcss postcss autoprefixer
```

Then generate config files for both Tailwind and PostCSS:

```shellscript nonumber
npx tailwindcss init --ts -p
```

<docs-warning>If your Remix project already has a PostCSS config file, you'll need to ensure that the `tailwindcss` plugin has been configured. This plugin was previously being injected by the Remix compiler if it was missing.</docs-warning>

Now we can tell it which files to generate classes from:

```ts filename=tailwind.config.ts lines=[4]
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

Then include the `@tailwind` directives somewhere in your app CSS. For example, you could create a `tailwind.css` file at the root of your app:

```css filename=app/tailwind.css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### Vanilla Extract

To use [Vanilla Extract][vanilla-extract] in Vite, install the official [Vite plugin][vanilla-extract-vite-plugin].

```shellscript nonumber
npm install -D @vanilla-extract/vite-plugin
```

Then add the plugin to your Vite config:

```ts filename=vite.config.ts
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix(), vanillaExtractPlugin()],
});
```

### MDX

Since Vite's plugin API is an extension of the Rollup plugin API, you can use the official [MDX Rollup plugin][mdx-rollup-plugin]:

```shellscript nonumber
npm install -D @mdx-js/rollup
```

Then add the Rollup plugin to your Vite config:

```ts filename=vite.config.ts
import mdx from "@mdx-js/rollup";
import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix(), mdx()],
});
```

#### MDX Frontmatter

The Remix compiler allowed you to define [frontmatter in MDX][mdx-frontmatter]. You can achieve this in Vite using [remark-mdx-frontmatter].

First, install the required [Remark][remark] plugins:

```shellscript nonumber
npm install -D remark-frontmatter remark-mdx-frontmatter
```

Then provide these plugins to the MDX Rollup plugin:

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

In the Remix compiler, the frontmatter export was named `attributes`. This differs from the frontmatter plugin's default export name of `frontmatter`. To maintain backwards compatibility with the Remix compiler, you can override this via the `name` option:

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
        [remarkMdxFrontmatter, { name: "attributes" }],
      ],
    }),
  ],
});
```

##### MDX Route Frontmatter

The Remix compiler allowed you to define `headers`, `meta` and `handle` route exports in your frontmatter. This Remix-specific feature is obviously not supported by the `remark-mdx-frontmatter` plugin, but you can manually map frontmatter to route exports yourself:

```mdx
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

By writing these MDX route exports yourself, you're free to use whatever frontmatter structure you like.

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

##### MDX Filename Export

The Remix compiler also provided a `filename` export from all MDX files. This was primarily designed to enable linking to collections of MDX routes. In Vite, you should achieve this via [glob imports][glob-imports] which give you a handy data structure that maps file names to modules. This makes it much easier to maintain a list of MDX files since you no longer need to import each one manually.

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

At first, this might seem like a compromise for DX when compared to the existing Remix compiler, but it actually has some nice benefits.
To start, the mental model is much simpler: `.server` is for server-only code, everything else could be on both the client and the server.
Additionally, this brings Remix in alignment with module-level `"use client"` and `"use server"` directives necessary for when Remix adopts React Server Components.

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
