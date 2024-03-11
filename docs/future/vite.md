---
title: Vite
---

# Vite

[Vite][vite] is a powerful, performant and extensible development environment for JavaScript projects. In order to improve and extend Remix's bundling capabilities, we now support Vite as an alternative compiler. In the future, Vite will become the default compiler for Remix.

## Classic Remix Compiler vs. Remix Vite

The existing Remix compiler, accessed via the `remix build` and `remix dev` CLI commands and configured via `remix.config.js`, is now referred to as the "Classic Remix Compiler".

The Remix Vite plugin and the `remix vite:build` and `remix vite:dev` CLI commands are collectively referred to as "Remix Vite".

Moving forwards, documentation will assume usage of Remix Vite unless otherwise stated.

## Getting started

We've got a few different Vite-based templates to get you started.

```shellscript nonumber
# Minimal server:
npx create-remix@latest --template remix-run/remix/templates/vite

# Express:
npx create-remix@latest --template remix-run/remix/templates/vite-express

# Cloudflare:
npx create-remix@latest --template remix-run/remix/templates/vite-cloudflare
```

These templates include a `vite.config.ts` file which is where the Remix Vite plugin is configured.

## Configuration

The Remix Vite plugin is configured via a `vite.config.ts` file at the root of your project. For more information, see our [Vite config documentation][vite-config].

## Cloudflare

To get started with Cloudflare, you can use the [`vite-cloudflare`][template-vite-cloudflare] template:

```shellscript nonumber
npx create-remix@latest --template remix-run/remix/templates/vite-cloudflare
```

There are two ways to run your Cloudflare app locally:

```shellscript nonumber
# Vite
remix vite:dev

# Wrangler
remix vite:build # build app before running wrangler
wrangler pages dev ./build/client
```

While Vite provides a better development experience, Wrangler provides closer emulation of the Cloudflare environment by running your server code in [Cloudflare's `workerd` runtime][cloudflare-workerd] instead of Node.

#### Cloudflare Proxy

To simulate the Cloudflare environment in Vite, Wrangler provides [Node proxies to local `workerd` bindings][wrangler-getplatformproxy].
Remix's Cloudflare Proxy plugin sets up these proxies for you:

```ts filename=vite.config.ts lines=[3,8]
import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remixCloudflareDevProxy(), remix()],
});
```

The proxies are then available within `context.cloudflare` in your `loader` or `action` functions:

```ts
export const loader = ({ context }: LoaderFunctionArgs) => {
  const { env, cf, ctx } = context.cloudflare;
  // ... more loader code here...
};
```

Check out [Cloudflare's `getPlatformProxy` docs][wrangler-getplatformproxy-return] for more information on each of these proxies.

#### Bindings

To configure bindings for Cloudflare resources:

- For local development with Vite or Wrangler, use [wrangler.toml][wrangler-toml-bindings]
- For deployments, use the [Cloudflare dashboard][cloudflare-pages-bindings]

Whenever you change your `wrangler.toml` file, you'll need to run `wrangler types` to regenerate your bindings.

Then, you can access your bindings via `context.cloudflare.env`.
For example, with a [KV namespace][cloudflare-kv] bound as `MY_KV`:

```ts filename=app/routes/_index.tsx
export async function loader({
  context,
}: LoaderFunctionArgs) {
  const { MY_KV } = context.cloudflare.env;
  const value = await MY_KV.get("my-key");
  return json({ value });
}
```

#### Augmenting load context

If you'd like to add additional properties to the load context,
you should export a `getLoadContext` function from a shared module so that **load context in Vite, Wrangler, and Cloudflare Pages are all augmented in the same way**:

```ts filename=load-context.ts lines=[1,4-9,20-33]
import { type AppLoadContext } from "@remix-run/cloudflare";
import { type PlatformProxy } from "wrangler";

// When using `wrangler.toml` to configure bindings,
// `wrangler types` will generate types for those bindings
// into the global `Env` interface.
// Need this empty interface so that typechecking passes
// even if no `wrangler.toml` exists.
interface Env {}

type Cloudflare = Omit<PlatformProxy<Env>, "dispose">;

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    cloudflare: Cloudflare;
    extra: string; // augmented
  }
}

type GetLoadContext = (args: {
  request: Request;
  context: { cloudflare: Cloudflare }; // load context _before_ augmentation
}) => AppLoadContext;

// Shared implementation compatible with Vite, Wrangler, and Cloudflare Pages
export const getLoadContext: GetLoadContext = ({
  context,
}) => {
  return {
    ...context,
    extra: "stuff",
  };
};
```

<docs-warning>You must pass in `getLoadContext` to **both** the Cloudflare Proxy plugin and the request handler in `functions/[[path]].ts`, otherwise you'll get inconsistent load context augmentation depending on how you run your app.</docs-warning>

First, pass in `getLoadContext` to the Cloudflare Proxy plugin in your Vite config to augment load context when running Vite:

```ts filename=vite.config.ts lines=[8,12]
import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { getLoadContext } from "./load-context";

export default defineConfig({
  plugins: [
    remixCloudflareDevProxy({ getLoadContext }),
    remix(),
  ],
});
```

Next, pass in `getLoadContext` to the request handler in your `functions/[[path]].ts` file to augment load context when running Wrangler or when deploying to Cloudflare Pages:

```ts filename=functions/[[path]].ts lines=[5,9]
import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";

// @ts-ignore - the server build file is generated by `remix vite:build`
import * as build from "../build/server";
import { getLoadContext } from "../load-context";

export const onRequest = createPagesFunctionHandler({
  build,
  getLoadContext,
});
```

## Splitting up client and server code

Vite handles mixed use of client and server code differently to the Classic Remix compiler. For more information, see our documentation on [splitting up client and server code][splitting-up-client-and-server-code].

## New build output paths

There is a notable difference with the way Vite manages the `public` directory compared to the existing Remix compiler. Vite copies files from the `public` directory into the client build directory, whereas the Remix compiler left the `public` directory untouched and used a subdirectory (`public/build`) as the client build directory.

In order to align the default Remix project structure with the way Vite works, the build output paths have been changed. There is now a single `buildDirectory` option that defaults to `"build"`, replacing the separate `assetsBuildDirectory` and `serverBuildDirectory` options. This means that, by default, the server is now compiled into `build/server` and the client is now compiled into `build/client`.

This also means that the following configuration defaults have been changed:

- [publicPath][public-path] has been replaced by [Vite's "base" option][vite-base] which defaults to `"/"` rather than `"/build/"`.
- [serverBuildPath][server-build-path] has been replaced by `serverBuildFile` which defaults to `"index.js"`. This file will be written into the server directory within your configured `buildDirectory`.

One of the reasons that Remix is moving to Vite is, so you have less to learn when adopting Remix.
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

#### HMR & HDR

Vite provides a robust client-side runtime for development features like HMR,
making the `<LiveReload />` component obsolete. When using the Remix Vite plugin in development,
the `<Scripts />` component will automatically include Vite's client-side runtime and other dev-only scripts.

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

#### TypeScript integration

Vite handles imports for all sorts of different file types, sometimes in ways that differ from the existing Remix compiler, so let's reference Vite's types from `vite/client` instead of the obsolete types from `@remix-run/dev`.

Since the module types provided by `vite/client` are not compatible with the module types implicitly included with `@remix-run/dev`, you'll also need to enable the `skipLibCheck` flag in your TypeScript config. Remix won't require this flag in the future once the Vite plugin is the default compiler.

👉 **Rename `remix.env.d.ts` to `env.d.ts`**

```diff nonumber
-/remix.env.d.ts
+/env.d.ts
```

👉 **Replace `@remix-run/dev` types with `vite/client` in `env.d.ts`**

```diff filename=env.d.ts
-/// <reference types="@remix-run/dev" />
+/// <reference types="vite/client" />
/// <reference types="@remix-run/node" />
```

👉 **Replace reference to `remix.env.d.ts` with `env.d.ts` in `tsconfig.json`**

```diff filename=tsconfig.json
- "include": ["remix.env.d.ts", "**/*.ts", "**/*.tsx"],
+ "include": ["env.d.ts", "**/*.ts", "**/*.tsx"],
```

👉 **Ensure `skipLibCheck` is enabled in `tsconfig.json`**

```json filename=tsconfig.json
"skipLibCheck": true,
```

👉 **Ensure `module` and `moduleResolution` fields are set correctly in `tsconfig.json`**

```json filename=tsconfig.json
"module": "ESNext",
"moduleResolution": "Bundler",
```

#### Migrating from Remix App Server

If you were using `remix-serve` in development (or `remix dev` without the `-c` flag), you'll need to switch to the new minimal dev server.
It comes built-in with the Remix Vite plugin and will take over when you run `remix vite:dev`.

The Remix Vite plugin doesn't install any [global Node polyfills][global-node-polyfills] so you'll need to install them yourself if you were relying on `remix-serve` to provide them. The easiest way to do this is by calling `installGlobals` at the top of your Vite config.

The Vite dev server's default port is different to `remix-serve` so you'll need to configure this via Vite's `server.port` option if you'd like to maintain the same port.

You'll also need to update to the new build output paths, which are `build/server` for the server and `build/client` for client assets.

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

#### Migrating a custom server

If you were using a custom server in development, you'll need to edit your custom server to use Vite's `connect` middleware.
This will delegate asset requests and initial render requests to Vite during development, letting you benefit from Vite's excellent DX even with a custom server.

You can then load the virtual module named `"virtual:remix/server-build"` during development to create a Vite-based request handler.

You'll also need to update your server code to reference the new build output paths, which are `build/server` for the server build and `build/client` for client assets.

For example, if you were using Express, here's how you could do it.

👉 **Update your `server.mjs` file**

```ts filename=server.mjs lines=[7-14,18-21,29,36-41]
import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import express from "express";

installGlobals();

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? undefined
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const app = express();

// handle asset requests
if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  app.use(
    "/assets",
    express.static("build/client/assets", {
      immutable: true,
      maxAge: "1y",
    })
  );
}
app.use(express.static("build/client", { maxAge: "1h" }));

// handle SSR requests
app.all(
  "*",
  createRequestHandler({
    build: viteDevServer
      ? () =>
          viteDevServer.ssrLoadModule(
            "virtual:remix/server-build"
          )
      : await import("./build/server/index.js"),
  })
);

const port = 3000;
app.listen(port, () =>
  console.log("http://localhost:" + port)
);
```

👉 **Update your `build`, `dev`, and `start` scripts**

```json filename=package.json lines=[3-5]
{
  "scripts": {
    "dev": "node ./server.mjs",
    "build": "remix vite:build",
    "start": "cross-env NODE_ENV=production node ./server.mjs"
  }
}
```

If you prefer, you can instead author your custom server in TypeScript.
You could then use tools like [`tsx`][tsx] or [`tsm`][tsm] to run your custom server:

```shellscript nonumber
tsx ./server.ts
node --loader tsm ./server.ts
```

Just remember that there might be some noticeable slowdown for initial server startup if you do this.

#### Migrating Cloudflare Functions

<docs-warning>

The Remix Vite plugin only officially supports [Cloudflare Pages][cloudflare-pages] which is specifically designed for fullstack applications, unlike [Cloudflare Workers Sites][cloudflare-workers-sites]. If you're currently on Cloudflare Workers Sites, refer to the [Cloudflare Pages migration guide][cloudflare-pages-migration-guide].

</docs-warning>

👉 **Setup the Cloudflare Remix preset, then add `"workerd"` and `"worker"` conditions**

```ts filename=vite.config.ts lines=[3,6,11,14-18]
import {
  vitePlugin as remix,
  cloudflarePreset as cloudflare,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import { getBindingsProxy } from "wrangler";

export default defineConfig({
  plugins: [
    remix({
      presets: [cloudflare(getBindingsProxy)],
    }),
  ],
  ssr: {
    resolve: {
      externalConditions: ["workerd", "worker"],
    },
  },
});
```

Your Cloudflare app may be setting the [the Remix Config `server` field][remix-config-server] to generate a catch-all Cloudflare Function.
With Vite, this indirection is no longer necessary.
Instead, you can author a catch-all route directly for Cloudflare, just like how you would for Express or any other custom servers.

👉 **Create a catch-all route for Remix**

```ts filename=functions/[[page]].ts
import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";

// @ts-ignore - the server build file is generated by `remix vite:build`
import * as build from "../build/server";

export const onRequest = createPagesFunctionHandler({
  build,
});
```

While you'll mostly use Vite during development, you can also use Wrangler to preview and deploy your app.
To learn more, see [_Cloudflare > Vite & Wrangler_][cloudflare-vite-and-wrangler].

👉 **Update your `package.json` scripts**

```json filename=package.json lines=[3-6]
{
  "scripts": {
    "dev": "remix vite:dev",
    "build": "remix vite:build",
    "preview": "wrangler pages dev ./build/client",
    "deploy": "wrangler pages deploy ./build/client"
  }
}
```

#### Migrate references to build output paths

When using the existing Remix compiler's default options, the server was compiled into `build` and the client was compiled into `public/build`. Due to differences with the way Vite typically works with its `public` directory compared to the existing Remix compiler, these output paths have changed.

👉 **Update references to build output paths**

- The server is now compiled into `build/server` by default.
- The client is now compiled into `build/client` by default.

For example, to update the Dockerfile from the [Blues Stack][blues-stack]:

```diff filename=Dockerfile
-COPY --from=build /myapp/build /myapp/build
-COPY --from=build /myapp/public /myapp/public
+COPY --from=build /myapp/build/server /myapp/build/server
+COPY --from=build /myapp/build/client /myapp/build/client
```

#### Configure path aliases

The Remix compiler leverages the `paths` option in your `tsconfig.json` to resolve path aliases. This is commonly used in the Remix community to define `~` as an alias for the `app` directory.

Vite does not provide any path aliases by default. If you were relying on this feature, you can install the [vite-tsconfig-paths][vite-tsconfig-paths] plugin to automatically resolve path aliases from your `tsconfig.json` in Vite, matching the behavior of the Remix compiler:

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

#### Remove `@remix-run/css-bundle`

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

If a route's `links` function is only used to wire up `cssBundleHref`, you can remove it entirely.

```diff filename=app/root.tsx
- import { cssBundleHref } from "@remix-run/css-bundle";
- import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

- export const links: LinksFunction = () => [
-   ...(cssBundleHref
-     ? [{ rel: "stylesheet", href: cssBundleHref }]
-     : []),
- ];
```

#### Fix up CSS imports referenced in `links`

<docs-info>This is not required for other forms of [CSS bundling][css-bundling], e.g. CSS Modules, CSS side effect imports, Vanilla Extract, etc.</docs-info>

If you are [referencing CSS in a `links` function][regular-css], you'll need to update the corresponding CSS imports to use [Vite's explicit `?url` import syntax.][vite-url-imports]

👉 **Add `?url` to CSS imports used in `links`**

<docs-warning>`.css?url` imports require Vite v5.1 or newer</docs-warning>

```diff
-import styles from "~/styles/dashboard.css";
+import styles from "~/styles/dashboard.css?url";

export const links = () => {
  return [
    { rel: "stylesheet", href: styles }
  ];
}
```

#### Enable Tailwind via PostCSS

If your project is using [Tailwind CSS][tailwind], you'll first need to ensure that you have a [PostCSS][postcss] config file which will get automatically picked up by Vite.
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
This is because the Remix compiler included this plugin automatically when Remix's [`tailwind` config option][tailwind-config-option] was enabled.

👉 **Add the `tailwindcss` plugin to your PostCSS config if it's missing**

```js filename=postcss.config.mjs lines=[3]
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

👉 **Migrate Tailwind CSS import**

If you're [referencing your Tailwind CSS file in a `links` function][regular-css], you'll need to [migrate your Tailwind CSS import statement.][fix-up-css-imports-referenced-in-links]

#### Add Vanilla Extract plugin

If you're using [Vanilla Extract][vanilla-extract], you'll need to set up the Vite plugin.

👉 **Install the official [Vanilla Extract plugin for Vite][vanilla-extract-vite-plugin]**

```shellscript nonumber
npm install -D @vanilla-extract/vite-plugin
```

👉 **Add the Vanilla Extract plugin to your Vite config**

```ts filename=vite.config.ts lines=[2,6]
import { vitePlugin as remix } from "@remix-run/dev";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix(), vanillaExtractPlugin()],
});
```

#### Add MDX plugin

If you're using [MDX][mdx], since Vite's plugin API is an extension of the [Rollup][rollup] plugin API, you should use the official [MDX Rollup plugin][mdx-rollup-plugin]:

👉 **Install the MDX Rollup plugin**

```shellscript nonumber
npm install -D @mdx-js/rollup
```

<docs-info>

The Remix plugin expects to process JavaScript or TypeScript files, so any transpilation from other languages — like MDX — must be done first.
In this case, that means putting the MDX plugin _before_ the Remix plugin.

</docs-info>

👉 **Add the MDX Rollup plugin to your Vite config**

```ts filename=vite.config.ts lines=[1,6]
import mdx from "@mdx-js/rollup";
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [mdx(), remix()],
});
```

##### Add MDX frontmatter support

The Remix compiler allowed you to define [frontmatter in MDX][mdx-frontmatter]. If you were using this feature, you can achieve this in Vite using [remark-mdx-frontmatter].

👉 **Install the required [Remark][remark] frontmatter plugins**

```shellscript nonumber
npm install -D remark-frontmatter remark-mdx-frontmatter
```

👉 **Pass the Remark frontmatter plugins to the MDX Rollup plugin**

```ts filename=vite.config.ts lines=[3-4,9-14]
import mdx from "@mdx-js/rollup";
import { vitePlugin as remix } from "@remix-run/dev";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    mdx({
      remarkPlugins: [
        remarkFrontmatter,
        remarkMdxFrontmatter,
      ],
    }),
    remix(),
  ],
});
```

In the Remix compiler, the frontmatter export was named `attributes`. This differs from the frontmatter plugin's default export name of `frontmatter`. Although it's possible to configure the frontmatter export name, we recommend updating your app code to use the default export name instead.

👉 **Rename MDX `attributes` export to `frontmatter` within MDX files**

```diff filename=app/posts/first-post.mdx
  ---
  title: Hello, World!
  ---

- # {attributes.title}
+ # {frontmatter.title}
```

👉 **Rename MDX `attributes` export to `frontmatter` for consumers**

```diff filename=app/routes/posts/first-post.tsx
  import Component, {
-   attributes,
+   frontmatter,
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

## Debugging

You can use the [`NODE_OPTIONS` environment variable][node-options] to start a debugging session:

```shellscript nonumber
NODE_OPTIONS="--inspect-brk" npm run dev
```

Then you can attach a debugger from your browser.
For example, in Chrome you can open up `chrome://inspect` or click the NodeJS icon in the dev tools to attach the debugger.

#### vite-plugin-inspect

[`vite-plugin-inspect`][vite-plugin-inspect] shows you each how each Vite plugin transforms your code and how long each plugin takes.

## Performance

Remix includes a `--profile` flag for performance profiling.

```shellscript nonumber
remix vite:build --profile
```

When running with `--profile`, a `.cpuprofile` file will be generated that can be shared or upload to speedscope.app to for analysis.

You can also profile in dev by pressing `p + enter` while the dev server is running to start a new profiling session or stop the current session.
If you need to profile dev server startup, you can also use the `--profile` flag to initialize a profiling session on startup:

```shellscript nonumber
remix vite:dev --profile
```

Remember that you can always check the [Vite performance docs][vite-perf] for more tips!

#### Bundle analysis

To visualize and analyze your bundle, you can use the [rollup-plugin-visualizer][rollup-plugin-visualizer] plugin:

```ts filename=vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    remix(),
    // `emitFile` is necessary since Remix builds more than one bundle!
    visualizer({ emitFile: true }),
  ],
});
```

Then when you run `remix vite:build`, it'll generate a `stats.html` file in each of your bundles:

```
build
├── client
│   ├── assets/
│   ├── favicon.ico
│   └── stats.html 👈
└── server
    ├── index.js
    └── stats.html 👈
```

Open up `stats.html` in your browser to analyze your bundle.

## Troubleshooting

Check the [debugging][debugging] and [performance][performance] sections for general troubleshooting tips.
Also, see if anyone else is having a similar problem by looking through the [known issues with the remix vite plugin on github][issues-vite].

#### HMR

If you are expecting hot updates but getting full page reloads,
check out our [discussion on Hot Module Replacement][hmr] to learn more about the limitations of React Fast Refresh and workarounds for common issues.

#### ESM / CJS

Vite supports both ESM and CJS dependencies, but sometimes you might still run into issues with ESM / CJS interop.
Usually, this is because a dependency is not properly configured to support ESM.
And we don't blame them, its [really tricky to support both ESM and CJS properly][modernizing-packages-to-esm].

For a walkthrough of fixing an example bug, check out [🎥 How to Fix CJS/ESM Bugs in Remix][how-fix-cjs-esm].

To diagnose if one of your dependencies is misconfigured, check [publint][publint] or [_Are The Types Wrong_][arethetypeswrong].
Additionally, you can use the [vite-plugin-cjs-interop plugin][vite-plugin-cjs-interop] smooth over issues with `default` exports for external CJS dependencies.

Finally, you can also explicitly configure which dependencies to bundle into your server bundled
with [Vite's `ssr.noExternal` option][ssr-no-external] to emulate the Remix compiler's [`serverDependenciesToBundle`][server-dependencies-to-bundle] with the Remix Vite plugin.

#### Server code errors in browser during development

If you see errors in the browser console during development that point to server code, you likely need to [explicitly isolate server-only code][explicitly-isolate-server-only-code].
For example, if you see something like:

```shellscript
Uncaught ReferenceError: process is not defined
```

Then you'll need to track down which module is pulling in dependencies that except server-only globals like `process` and isolate code either in a [separate `.server` module or with `vite-env-only`][explicitly-isolate-server-only-code].
Since Vite uses Rollup to treeshake your code in production, these errors only occur in development.

#### Plugin usage with other Vite-based tools (e.g. Vitest, Storybook)

The Remix Vite plugin is only intended for use in your application's development server and production builds.
While there are other Vite-based tools such as Vitest and Storybook that make use of the Vite config file, the Remix Vite plugin has not been designed for use with these tools.
We currently recommend excluding the plugin when used with other Vite-based tools.

For Vitest:

```ts filename=vite.config.ts lines=[5]
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, loadEnv } from "vite";

export default defineConfig({
  plugins: [!process.env.VITEST && remix()],
  test: {
    environment: "happy-dom",
    // Additionally, this is to load ".env.test" during vitest
    env: loadEnv("test", process.cwd(), ""),
  },
});
```

For Storybook:

```ts filename=vite.config.ts lines=[7]
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

const isStorybook = process.argv[1]?.includes("storybook");

export default defineConfig({
  plugins: [!isStorybook && remix()],
});
```

Alternatively, you can use separate Vite config files for each tool.
For example, to use a Vite config specifically scoped to Remix:

```shellscript nonumber
remix vite:dev --config vite.config.remix.ts
```

When not providing the Remix Vite plugin, your setup might also need to provide [Vite Plugin React][vite-plugin-react]. For example, when using Vitest:

```ts filename=vite.config.ts lines=[2,6]
import { vitePlugin as remix } from "@remix-run/dev";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig({
  plugins: [!process.env.VITEST ? remix() : react()],
  test: {
    environment: "happy-dom",
    // Additionally, this is to load ".env.test" during vitest
    env: loadEnv("test", process.cwd(), ""),
  },
});
```

#### Styles disappearing in development when document remounts

When React is used to render the entire document (as Remix does) you can run into issues when elements are dynamically injected into the `head` element. If the document is re-mounted, the existing `head` element is removed and replaced with an entirely new one, removing any `style` elements that Vite injects during development.

This is a known React issue that is fixed in their [canary release channel][react-canaries]. If you understand the risks involved, you can pin your app to a specific [React version][react-versions] and then use [package overrides][package-overrides] to ensure this is the only version of React used throughout your project. For example:

```json filename=package.json
{
  "dependencies": {
    "react": "18.3.0-canary-...",
    "react-dom": "18.3.0-canary-..."
  },
  "overrides": {
    "react": "18.3.0-canary-...",
    "react-dom": "18.3.0-canary-..."
  }
}
```

<docs-info>For reference, this is how Next.js treats React versioning internally on your behalf, so this approach is more widely used than you might expect, even though it's not something Remix provides as a default.</docs-info>

It's worth stressing that this issue with styles that were injected by Vite only happens in development. **Production builds won't have this issue** since static CSS files are generated.

In Remix, this issue can surface when rendering alternates between your [root route's default component export][route-component] and its [ErrorBoundary][error-boundary] and/or [HydrateFallback][hydrate-fallback] exports since this results in a new document-level component being mounted.

It can also happen due to hydration errors since it causes React to re-render the entire page from scratch. Hydration errors can be caused by your app code, but they can also be caused by browser extensions that manipulate the document.

This is relevant for Vite because—during development—Vite transforms CSS imports into JS files that inject their styles into the document as a side-effect. Vite does this to support lazy-loading and HMR of static CSS files.

For example, let's assume your app has the following CSS file:

<!-- prettier-ignore -->
```css filename=app/styles.css
* { margin: 0 }
```

During development, this CSS file will be transformed into the following JavaScript code when imported as a side effect:

<!-- prettier-ignore-start -->

<!-- eslint-skip -->

```js
import {createHotContext as __vite__createHotContext} from "/@vite/client";
import.meta.hot = __vite__createHotContext("/app/styles.css");
import {updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle} from "/@vite/client";
const __vite__id = "/path/to/app/styles.css";
const __vite__css = "*{margin:0}"
__vite__updateStyle(__vite__id, __vite__css);
import.meta.hot.accept();
import.meta.hot.prune(()=>__vite__removeStyle(__vite__id));
```

<!-- prettier-ignore-end -->

This transformation is not applied to production code, which is why this styling issue only affects development.

#### Wrangler errors in development

When using Cloudflare Pages, you may encounter the following error from `wrangler pages dev`:

```txt nonumber
ERROR: Your worker called response.clone(), but did not read the body of both clones.
This is wasteful, as it forces the system to buffer the entire response body
in memory, rather than streaming it through. This may cause your worker to be
unexpectedly terminated for going over the memory limit. If you only meant to
copy the response headers and metadata (e.g. in order to be able to modify
them), use `new Response(response.body, response)` instead.
```

This is a [known issue with Wrangler][cloudflare-request-clone-errors].

</docs-info>

## Acknowledgements

Vite is an amazing project, and we're grateful to the Vite team for their work.
Special thanks to [Matias Capeletto, Arnaud Barré, and Bjorn Lu from the Vite team][vite-team] for their guidance.

The Remix community was quick to explore Vite support, and we're grateful for their contributions:

- [Discussion: Consider using Vite][consider-using-vite]
- [remix-kit][remix-kit]
- [remix-vite][remix-vite]
- [vite-plugin-remix][vite-plugin-remix]

Finally, we were inspired by how other frameworks implemented Vite support:

- [Astro][astro]
- [SolidStart][solidstart]
- [SvelteKit][sveltekit]

[vite]: https://vitejs.dev
[template-vite-cloudflare]: https://github.com/remix-run/remix/tree/main/templates/vite-cloudflare
[public-path]: ../file-conventions/remix-config#publicpath
[server-build-path]: ../file-conventions/remix-config#serverbuildpath
[vite-config]: ../file-conventions/vite-config
[vite-plugins]: https://vitejs.dev/plugins
[vite-features]: https://vitejs.dev/guide/features
[supported-remix-config-options]: #configuration
[tsx]: https://github.com/esbuild-kit/tsx
[tsm]: https://github.com/lukeed/tsm
[vite-tsconfig-paths]: https://github.com/aleclarson/vite-tsconfig-paths
[css-bundling]: ../styling/bundling
[regular-css]: ../styling/css
[vite-url-imports]: https://vitejs.dev/guide/assets.html#explicit-url-imports
[tailwind]: https://tailwindcss.com
[postcss]: https://postcss.org
[tailwind-config-option]: ../file-conventions/remix-config#tailwind
[vanilla-extract]: https://vanilla-extract.style
[vanilla-extract-vite-plugin]: https://vanilla-extract.style/documentation/integrations/vite
[mdx]: https://mdxjs.com
[rollup]: https://rollupjs.org
[mdx-rollup-plugin]: https://mdxjs.com/packages/rollup
[mdx-frontmatter]: https://mdxjs.com/guides/frontmatter
[remark-mdx-frontmatter]: https://github.com/remcohaszing/remark-mdx-frontmatter
[remark]: https://remark.js.org
[glob-imports]: https://vitejs.dev/guide/features.html#glob-import
[issues-vite]: https://github.com/remix-run/remix/labels/vite
[hmr]: ../discussion/hot-module-replacement
[vite-team]: https://vitejs.dev/team
[consider-using-vite]: https://github.com/remix-run/remix/discussions/2427
[remix-kit]: https://github.com/jrestall/remix-kit
[remix-vite]: https://github.com/sudomf/remix-vite
[vite-plugin-remix]: https://github.com/yracnet/vite-plugin-remix
[astro]: https://astro.build/
[solidstart]: https://start.solidjs.com/getting-started/what-is-solidstart
[sveltekit]: https://kit.svelte.dev/
[modernizing-packages-to-esm]: https://blog.isquaredsoftware.com/2023/08/esm-modernization-lessons/
[arethetypeswrong]: https://arethetypeswrong.github.io/
[publint]: https://publint.dev/
[vite-plugin-cjs-interop]: https://github.com/cyco130/vite-plugin-cjs-interop
[ssr-no-external]: https://vitejs.dev/config/ssr-options.html#ssr-noexternal
[server-dependencies-to-bundle]: https://remix.run/docs/en/main/file-conventions/remix-config#serverdependenciestobundle
[blues-stack]: https://github.com/remix-run/blues-stack
[global-node-polyfills]: ../other-api/node#polyfills
[server-bundles]: ./server-bundles
[vite-plugin-inspect]: https://github.com/antfu/vite-plugin-inspect
[vite-perf]: https://vitejs.dev/guide/performance.html
[node-options]: https://nodejs.org/api/cli.html#node_optionsoptions
[rollup-plugin-visualizer]: https://github.com/btd/rollup-plugin-visualizer
[debugging]: #debugging
[performance]: #performance
[server-vs-client]: ../discussion/server-vs-client.md
[vite-env-only]: https://github.com/pcattori/vite-env-only
[explicitly-isolate-server-only-code]: #splitting-up-client-and-server-code
[route-component]: ../route/component
[error-boundary]: ../route/error-boundary
[hydrate-fallback]: ../route/hydrate-fallback
[react-canaries]: https://react.dev/blog/2023/05/03/react-canaries
[react-versions]: https://www.npmjs.com/package/react?activeTab=versions
[package-overrides]: https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides
[wrangler-toml-bindings]: https://developers.cloudflare.com/workers/wrangler/configuration/#bindings
[cloudflare-pages]: https://pages.cloudflare.com
[cloudflare-workers-sites]: https://developers.cloudflare.com/workers/configuration/sites
[cloudflare-pages-migration-guide]: https://developers.cloudflare.com/pages/migrations/migrating-from-workers
[cloudflare-request-clone-errors]: https://github.com/cloudflare/workers-sdk/issues/3259
[cloudflare-pages-bindings]: https://developers.cloudflare.com/pages/functions/bindings/
[cloudflare-kv]: https://developers.cloudflare.com/pages/functions/bindings/#kv-namespaces
[cloudflare-workerd]: https://blog.cloudflare.com/workerd-open-source-workers-runtime
[wrangler-getplatformproxy]: https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy
[wrangler-getplatformproxy-return]: https://developers.cloudflare.com/workers/wrangler/api/#return-type-1
[remix-config-server]: https://remix.run/docs/en/main/file-conventions/remix-config#server
[cloudflare-vite-and-wrangler]: #vite--wrangler
[rr-basename]: https://reactrouter.com/routers/create-browser-router#basename
[vite-public-base-path]: https://vitejs.dev/config/shared-options.html#base
[vite-base]: https://vitejs.dev/config/shared-options.html#base
[how-fix-cjs-esm]: https://www.youtube.com/watch?v=jmNuEEtwkD4
[presets]: ./presets
[fix-up-css-imports-referenced-in-links]: #fix-up-css-imports-referenced-in-links
[vite-plugin-react]: https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react
[splitting-up-client-and-server-code]: ../discussion/server-vs-client.md
