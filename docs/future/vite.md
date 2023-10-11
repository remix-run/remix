---
title: Vite (Unstable)
toc: false
---

# Vite (Unstable)

<docs-warning>Vite support is currently unstable and only intended to gather early feedback. We don't yet recommend using this in production.</docs-warning>

[Vite] is a powerful, performant and extensible development environment for JavaScript projects. In order to improve and extend Remix's bundling capabilities, we're currently exploring the use of Vite as an alternative compiler to esbuild.

| Feature                      | Node | Deno | Cloudflare | Notes                                     |
| ---------------------------- | ---- | ---- | ---------- | ----------------------------------------- |
| Built-in dev server          | ✅   | ❓   | ⏳         |                                           |
| Other servers (e.g. Express) | ⏳   | ⏳   | ⏳         |                                           |
| HMR                          | ✅   | ❓   | ⏳         |                                           |
| HDR                          | ✅   | ❓   | ⏳         |                                           |
| MDX                          | ⏳   | ⏳   | ⏳         | https://github.com/vitejs/vite/pull/14560 |

To get started with Vite in an existing Remix project (or a new one created with [create-remix]), first install Vite as a dev dependency:

```shellscript nonumber
npm install -D vite
```

Then add `vite.config.mjs` to the project root, providing the Remix plugin to the `plugins` array:

```js filename=vite.config.mjs
import { unstable_remixVitePlugin } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [unstable_remixVitePlugin()],
});
```

The Vite plugin accepts the following subset of Remix config options:

<docs-warning>Note that `remix.config.js` is not used by the Remix Vite plugin unless you manually import it in your Vite config and pass it to the plugin.</docs-warning>

- [appDirectory][appdirectory]
- [assetsBuildDirectory][assetsbuilddirectory]
- [ignoredRouteFiles][ignoredroutefiles]
- [publicPath][publicpath]
- [routes][routes]
- [serverBuildPath][serverbuildpath]
- [serverModuleFormat][servermoduleformat]

For example:

```js filename=vite.config.mjs
import { unstable_remixVitePlugin } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    unstable_remixVitePlugin({
      ignoredRouteFiles: ["**/.*"],
    }),
  ],
});
```

All other bundling-related options are now [configured with Vite][vite-config]. This means you have much greater control over the bundling process.

To start a development server or run a production build using Vite, set the `REMIX_EXPERIMENTAL_VITE` environment variable when running Remix's `dev` and `build` commands:

<docs-info>You can use [cross-env](https://www.npmjs.com/package/cross-env) to set this environment variable in a cross-platform manner.</docs-info>

```shellscript nonumber
# Start a development server:
cross-env REMIX_EXPERIMENTAL_VITE=1 remix dev

# Run a production build:
cross-env REMIX_EXPERIMENTAL_VITE=1 remix build
```

## Differences When Using Vite

Since Vite is now responsible for bundling your app, there are some differences between Vite and the Remix compiler that you'll need to be aware of.

### New Bundling Features

Vite has many [features][vite-features] and [plugins][vite-plugins] that are not built into the Remix compiler. Any use of these features will break backwards compatibility with the Remix compiler and should only be used if you intend to use Vite exclusively.

### Path Aliases

The Remix compiler leverages the `paths` option in your `tsconfig.json` to resolve path aliases. This is commonly used in the Remix community to define `~` as an alias for the `app` directory.

Vite does not provide any path aliases by default. You can install the [vite-tsconfig-paths][vite-tsconfig-paths] plugin to automatically resolve path aliases from your `tsconfig.json` in Vite, matching the behavior of the Remix compiler:

```shellscript nonumber
npm install -D vite-tsconfig-paths
```

Then add it to your Vite config:

```js filename=vite.config.mjs
import { unstable_remixVitePlugin } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [unstable_remixVitePlugin(), tsconfigPaths()],
});
```

Alternatively, you can define path aliases without referencing `tsconfig.json` by using Vite's [`resolve.alias`][vite-resolve-alias] option directly:

```js filename=vite.config.mjs
import { fileURLToPath, URL } from "node:url";

import { unstable_remixVitePlugin } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  plugins: [unstable_remixVitePlugin()],
});
```

### Regular CSS Imports

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

```js filename=vite.config.mjs
import { unstable_remixVitePlugin } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    unstable_remixVitePlugin({
      legacyCssImports: true,
    }),
  ],
});
```

### CSS Bundling

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

### Tailwind

To use [Tailwind] in Vite, first install the required dependencies:

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

### Vanilla Extract

To use [Vanilla Extract][vanilla-extract] in Vite, install the official [Vite plugin][vanilla-extract-vite-plugin].

```shellscript nonumber
npm install -D @vanilla-extract/vite-plugin
```

Then add the plugin to your Vite config:

```js filename=vite.config.mjs
import { unstable_remixVitePlugin } from "@remix-run/dev";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    unstable_remixVitePlugin(),
    vanillaExtractPlugin(),
  ],
});
```

### MDX

Since Vite's plugin API is an extension of the Rollup plugin API, you can use the official MDX Rollup plugin in Vite:

```shellscript nonumber
npm install -D @mdx-js/rollup
```

Then add the Rollup plugin to your Vite config:

```js filename=vite.config.mjs
import mdx from "@mdx-js/rollup";
import { unstable_remixVitePlugin } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [unstable_remixVitePlugin(), mdx()],
});
```

The Remix compiler allowed you to define [frontmatter in MDX][mdx-frontmatter] including `headers`, `meta` and `handle` route exports. To reinstate this feature, you can install the following [Remark][remark] plugins:

```shellscript nonumber
npm install -D remark-frontmatter @remix-run/remix-remark-mdx-frontmatter
```

<docs-info>These plugins are entirely optional. You can use [remark-mdx-frontmatter] if you don't need your frontmatter to contain Remix route exports (these can be defined with regular export statements if you prefer), or you can skip using frontmatter entirely.</docs-info>

Then provide these plugins to the MDX Rollup plugin:

```js filename=vite.config.mjs
import mdx from "@mdx-js/rollup";
import { unstable_remixVitePlugin } from "@remix-run/dev";
import { experimental_remarkRemixMdxFrontmatter } from "@remix-run/remix-remark-mdx-frontmatter";
import remarkFrontmatter from "remark-frontmatter";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    unstable_remixVitePlugin(),
    mdx({
      remarkPlugins: [
        remarkFrontmatter,
        experimental_remarkRemixMdxFrontmatter,
      ],
    }),
  ],
});
```

By default the `@remix-run/remark-remix-mdx-frontmatter` plugin provides frontmatter via the `frontmatter` export. This differs from the Remix compiler's frontmatter export name of `attributes`.

To maintain backwards compatibility with the Remix compiler, you can override this via the `name` option and revert it to its original `attributes` export:

```js filename=vite.config.mjs
import mdx from "@mdx-js/rollup";
import { unstable_remixVitePlugin } from "@remix-run/dev";
import { experimental_remarkRemixMdxFrontmatter } from "@remix-run/remix-remark-mdx-frontmatter";
import remarkFrontmatter from "remark-frontmatter";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    unstable_remixVitePlugin(),
    mdx({
      remarkPlugins: [
        remarkFrontmatter,
        [
          experimental_remarkRemixMdxFrontmatter,
          { name: "attributes" },
        ],
      ],
    }),
  ],
});
```

### `*.server.ts` and `*.client.ts` Extensions

The Remix compiler allowed you to define server/client-only files using the `*.server.ts`/`*.client.ts` extensions. The Remix Vite plugin supports this pattern with one notable difference.

Since Vite leverages ESM at runtime to load modules, you may need to use `import *` when importing server/client-only files if the import statement hasn't been removed by dead code elimination.

```diff
-import { something } from "./file.server.ts";
+import * as serverOnly from "./file.server.ts";
```

## HMR & HDR

### React Fast Refresh limitations

[React Fast Refresh][react_refresh] does not preserve state for class components.
This includes higher-order components that internally return classes:

```ts
export class ComponentA extends Component {} // ❌

export const ComponentB = HOC(ComponentC); // ❌ won't work if HOC returns a class component

export function ComponentD() {} // ✅
export const ComponentE = () => {}; // ✅
export default function ComponentF() {} // ✅
```

Function components must be named, not anonymous, for React Fast Refresh to track changes:

```ts
export default () => {}; // ❌
export default function () {} // ❌

const ComponentA = () => {};
export default ComponentA; // ✅

export default function ComponentB() {} // ✅
```

React Fast Refresh can only handle component exports. While Remix manages special route exports like `meta`, `links`, and `header` for you, any user-defined, will cause full reloads:

```ts
// these exports are specially handled by Remix to be HMR-compatible
export const meta = { title: "Home" }; // ✅
export const links = [
  { rel: "stylesheet", href: "style.css" },
]; // ✅
export const headers = { "Cache-Control": "max-age=3600" }; // ✅

// these exports are treeshaken by Remix, so they never affect HMR
export const loader = () => {}; // ✅
export const action = () => {}; // ✅

// This is not a Remix export, nor a component export
// so it will cause a full reloads for this route
export const myValue = "some value"; // ❌

export default function Route() {} // ✅
```

👆 Routes probably shouldn't be exporting random values like that anyway.
If you want to reuse values across routes, stick them in their own non-route module:

```ts filename=my-custom-value.ts
export const myValue = "some value";
```

React Fast Refresh cannot track changes for a component when hooks are being added or removed from it,
causing full reloads just for the next render. After the hooks has been added, changes should result in hot updates again.
For example, if you add [`useLoaderData`][use_loader_data] to your component, you may lose state local to that component for that render.

In some cases React cannot distinguish between existing components being changed and new components being added.
[React needs `key`s][react_keys] to disambiguate these cases and track changes when sibling elements are modified.

These are all limitations of React and [React Refresh][react_refresh], not Remix.

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
- [SvelteKit][svletekit]

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
[mdx-frontmatter]: https://mdxjs.com/guides/frontmatter
[remark-mdx-frontmatter]: https://github.com/remcohaszing/remark-mdx-frontmatter
[remark]: https://remark.js.org
[use_loader_data]: ../hooks/use-loader-data
[react_refresh]: https://github.com/facebook/react/tree/main/packages/react-refresh
[vite-team]: https://vitejs.dev/team.html
[consider-using-vite]: https://github.com/remix-run/remix/discussions/2427
[remix-kit]: https://github.com/jrestall/remix-kit
[remix-vite]: https://github.com/sudomf/remix-vite
[vite-plugin-remix]: https://github.com/yracnet/vite-plugin-remix
[astro]: https://astro.build/
[solidstart]: https://start.solidjs.com/getting-started/what-is-solidstart
[sveltekit]: https://kit.svelte.dev/
