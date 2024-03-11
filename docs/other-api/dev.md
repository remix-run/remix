---
title: "@remix-run/dev CLI"
order: 2
new: true
---

# Remix CLI

The Remix CLI comes from the `@remix-run/dev` package. It also includes the compiler. Make sure it is in your `package.json` `devDependencies` so it doesn't get deployed to your server.

To get a full list of available commands and flags, run:

```shellscript nonumber
npx @remix-run/dev -h
```

## `remix vite:build`

Builds your app for production with [Remix Vite][remix-vite]. This command will set `process.env.NODE_ENV` to `production` and minify the output for deployment.

```shellscript nonumber
remix vite:build
```

| Flag                  | Description                                             | Type                                                | Default     |
| --------------------- | ------------------------------------------------------- | --------------------------------------------------- | ----------- |
| `--assetsInlineLimit` | Static asset base64 inline threshold in bytes           | `number`                                            | `4096`      |
| `--clearScreen`       | Allow/disable clear screen when logging                 | `boolean`                                           |             |
| `--config`, `-c`      | Use specified config file                               | `string`                                            |             |
| `--emptyOutDir`       | Force empty outDir when it's outside of root            | `boolean`                                           |             |
| `--logLevel`, `-l`    | Use specified log level                                 | `"info" \| "warn" \| "error" \| "silent" \| string` |             |
| `--minify`            | Enable/disable minification, or specify minifier to use | `boolean \| "terser" \| "esbuild"`                  | `"esbuild"` |
| `--mode`, `-m`        | Set env mode                                            | `string`                                            |             |
| `--profile`           | Start built-in Node.js inspector                        |                                                     |             |
| `--sourcemapClient`   | Output source maps for client build                     | `boolean \| "inline" \| "hidden"`                   | `false`     |
| `--sourcemapServer`   | Output source maps for server build                     | `boolean \| "inline" \| "hidden"`                   | `false`     |

## `remix vite:dev`

Runs your app in development mode with [Remix Vite][remix-vite].

```shellscript nonumber
remix vite:dev
```

| Flag               | Description                                           | Type                                                | Default |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------- | ------- |
| `--clearScreen`    | Allow/disable clear screen when logging               | `boolean`                                           |         |
| `--config`, `-c`   | Use specified config file                             | `string`                                            |         |
| `--cors`           | Enable CORS                                           | `boolean`                                           |         |
| `--force`          | Force the optimizer to ignore the cache and re-bundle | `boolean`                                           |         |
| `--host`           | Specify hostname                                      | `string`                                            |         |
| `--logLevel`, `-l` | Use specified log level                               | `"info" \| "warn" \| "error" \| "silent" \| string` |         |
| `--mode`, `-m`     | Set env mode                                          | `string`                                            |         |
| `--open`           | Open browser on startup                               | `boolean \| string`                                 |         |
| `--port`           | Specify port                                          | `number`                                            |         |
| `--profile`        | Start built-in Node.js inspector                      |                                                     |         |
| `--strictPort`     | Exit if specified port is already in use              | `boolean`                                           |         |

## Classic Remix Compiler Commands

<docs-warning>This documentation is only relevant when using the [Classic Remix Compiler][classic-remix-compiler].</docs-warning>

### `remix build`

Builds your app for production with the [Classic Remix Compiler][classic-remix-compiler]. This command will set `process.env.NODE_ENV` to `production` and minify the output for deployment.

```shellscript nonumber
remix build
```

#### Options

| Option                                   | flag          | config | default |
| ---------------------------------------- | ------------- | ------ | ------- |
| Generate sourcemaps for production build | `--sourcemap` | N/A    | `false` |

## `remix dev`

Runs the [Classic Remix Compiler][classic-remix-compiler] in watch mode and spins up your app server.

The Remix compiler will:

1. Set `NODE_ENV` to `development`
2. Watch your app code for changes and trigger rebuilds
3. Restart your app server whenever rebuilds succeed
4. Send code updates to the browser via Live Reload and HMR + Hot Data Revalidation

🎥 For an introduction and deep dive into HMR and HDR in Remix, check out our videos:

- [HMR and Hot Data Revalidation 🔥][hmr_and_hdr]
- [Mental model for the new dev flow 🧠][mental_model]
- [Migrating your project to v2 dev flow 🚚][migrating]

<docs-info>

What is "Hot Data Revalidation"?

Like HMR, HDR is a way of hot updating your app without needing to refresh the page.
That way you can keep your app state as your edits are applied in your app.
HMR handles client-side code updates like when you change the components, markup, or styles in your app.
Likewise, HDR handles server-side code updates.

That means any time your change a [`loader`][loader] on your current page (or any code that your `loader` depends on), Remix will re-fetch data from your changed loader.
That way your app is _always_ up-to-date with the latest code changes, client-side or server-side.

To learn more about how HMR and HDR work together, check out [Pedro's talk at Remix Conf 2023][legendary_dx].

</docs-info>

#### With custom app server

If you used a template to get started, hopefully it's already integrated with `remix dev` out-of-the-box.
If not, you can follow these steps to integrate your project with `remix dev`:

1. Replace your dev scripts in `package.json` and use `-c` to specify your app server command:

   ```json filename=package.json
   {
     "scripts": {
       "dev": "remix dev -c \"node ./server.js\""
     }
   }
   ```

2. Ensure `broadcastDevReady` is called when your app server is up and running:

   ```ts filename=server.ts lines=[12,25-27]
   import path from "node:path";

   import { broadcastDevReady } from "@remix-run/node";
   import express from "express";

   const BUILD_DIR = path.resolve(__dirname, "build");
   const build = require(BUILD_DIR);

   const app = express();

   // ... code for setting up your express app goes here ...

   app.all("*", createRequestHandler({ build }));

   const port = 3000;
   app.listen(port, () => {
     console.log(`👉 http://localhost:${port}`);

     if (process.env.NODE_ENV === "development") {
       broadcastDevReady(build);
     }
   });
   ```

   <docs-info>

   For CloudFlare, use `logDevReady` instead of `broadcastDevReady`.

   Why? `broadcastDevReady` uses [`fetch`][fetch] to send a ready message to the Remix compiler,
   but CloudFlare does not support async I/O like `fetch` outside of request handling.

   </docs-info>

#### Options

Options priority order is: 1. flags, 2. config, 3. defaults.

| Option          | flag               | config    | default                           | description                                              |
| --------------- | ------------------ | --------- | --------------------------------- | -------------------------------------------------------- |
| Command         | `-c` / `--command` | `command` | `remix-serve <server build path>` | Command used to run your app server                      |
| Manual          | `--manual`         | `manual`  | `false`                           | See [guide for manual mode][manual_mode]                 |
| Port            | `--port`           | `port`    | Dynamically chosen open port      | Internal port used by the Remix compiler for hot updates |
| TLS key         | `--tls-key`        | `tlsKey`  | N/A                               | TLS key for configuring local HTTPS                      |
| TLS certificate | `--tls-cert`       | `tlsCert` | N/A                               | TLS certificate for configuring local HTTPS              |

For example:

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  dev: {
    // ...any other options you want to set go here...
    manual: true,
    tlsKey: "./key.pem",
    tlsCert: "./cert.pem",
  },
};
```

#### Setting a custom port

The `remix dev --port` option sets the internal port used for hot updates.
**It does not affect the port your app runs on.**

To set your app server port, set it the way you normally would in production.
For example, you may have it hardcoded in your `server.js` file.

If you are using `remix-serve` as your app server, you can use its `--port` flag to set the app server port:

```shellscript nonumber
remix dev -c "remix-serve --port 8000 ./build/index.js"
```

In contrast, the `remix dev --port` option is an escape-hatch for users who need fine-grain control of network ports.
Most users, should not need to use `remix dev --port`.

#### Manual mode

By default, `remix dev` will restart your app server whenever a rebuild occurs.
If you'd like to keep your app server running without restarts across rebuilds, check out our [guide for manual mode][manual_mode].

You can see if app server restarts are a bottleneck for your project by comparing the times reported by `remix dev`:

- `rebuilt (Xms)` 👉 the Remix compiler took `X` milliseconds to rebuild your app
- `app server ready (Yms)` 👉 Remix restarted your app server, and it took `Y` milliseconds to start with the new code changes

#### Pick up changes from other packages

If you are using a monorepo, you might want Remix to perform hot updates not only when your app code changes, but whenever you change code in any of your apps dependencies.

For example, you could have a UI library package (`packages/ui`) that is used within your Remix app (`packages/app`).
To pick up changes in `packages/ui`, you can configure [watchPaths][watch_paths] to include your packages.

#### How to set up MSW

To use [Mock Service Worker][msw] in development, you'll need to:

1. Run MSW as part of your app server
2. Configure MSW to not mock internal "dev ready" messages to the Remix compiler

Make sure that you are setting up your mocks for your _app server_ within the `-c` flag so that the `REMIX_DEV_ORIGIN` environment variable is available to your mocks.
For example, you can use `NODE_OPTIONS` to set Node's `--require` flag when running `remix-serve`:

```json filename=package.json
{
  "scripts": {
    "dev": "remix dev -c \"npm run dev:app\"",
    "dev:app": "cross-env NODE_OPTIONS=\"--require ./mocks\" remix-serve ./build"
  }
}
```

If you're using ESM as the default module system you will need to set the `--import` flag instead of `--require`:

```json filename=package.json
{
  "scripts": {
    "dev": "remix dev -c \"npm run dev:app\"",
    "dev:app": "cross-env NODE_OPTIONS=\"--import ./mocks/index.js\" remix-serve ./build/index.js"
  }
}
```

Next, you can use `REMIX_DEV_ORIGIN` to let MSW forward internal "dev ready" messages on `/ping`:

```ts
import { http, passthrough } from "msw";

const REMIX_DEV_PING = new URL(
  process.env.REMIX_DEV_ORIGIN
);
REMIX_DEV_PING.pathname = "/ping";

export const server = setupServer(
  http.post(REMIX_DEV_PING.href, () => passthrough())
  // ... other request handlers go here ...
);
```

#### How to integrate with a reverse proxy

Let's say you have the app server and Remix compiler both running on the same machine:

- App server 👉 `http://localhost:1234`
- Remix compiler 👉 `http://localhost:5678`

Then, you set up a reverse proxy in front of the app server:

- Reverse proxy 👉 `https://myhost`

But the internal HTTP and WebSocket connections to support hot updates will still try to reach the Remix compiler's unproxied origin:

- Hot updates 👉 `http://localhost:5678` / `ws://localhost:5678` ❌

To get the internal connections to point to the reverse proxy, you can use the `REMIX_DEV_ORIGIN` environment variable:

```shellscript nonumber
REMIX_DEV_ORIGIN=https://myhost remix dev
```

Now, hot updates will be sent correctly to the proxy:

- Hot updates 👉 `https://myhost` / `wss://myhost` ✅

#### Performance tuning and debugging

##### Path imports

Currently, when Remix rebuilds your app, the compiler has to process your app code along with any of its dependencies.
The compiler tree-shakes unused code from app so that you don't ship any unused code to browser and so that you keep your server as slim as possible.
But the compiler still needs to _crawl_ all the code to know what to keep and what to tree shake away.

In short, this means that the way you do imports and exports can have a big impact on how long it takes to rebuild your app.
For example, if you are using a library like Material UI or AntD you can likely speed up your builds by using [path imports][path_imports]:

```diff
- import { Button, TextField } from '@mui/material';
+ import Button from '@mui/material/Button';
+ import TextField from '@mui/material/TextField';
```

In the future, Remix could pre-bundle dependencies in development to avoid this problem entirely.
But today, you can help the compiler out by using path imports.

##### Debugging bundles

Depending on your app and dependencies, you might be processing much more code than your app needs.
Check out our [bundle analysis guide][bundle_analysis] for more details.

#### Troubleshooting

##### HMR

If you are expecting hot updates but getting full page reloads,
check out our [discussion on Hot Module Replacement][hmr] to learn more about the limitations of React Fast Refresh and workarounds for common issues.

##### HDR: every code change triggers HDR

Hot Data Revalidation detects loader changes by trying to bundle each loader and then fingerprinting the content for each.
It relies on tree shaking to determine whether your changes affect each loader or not.

To ensure that tree shaking can reliably detect changes to loaders, make sure you declare that your app's package is side effect free:

```json filename=package.json
{
  "sideEffects": false
}
```

##### HDR: harmless console errors when loader data is removed

When you delete a loader or remove some of the data being returned by that loader, your app should be hot updated correctly.
But you may notice console errors logged in your browser.

React strict-mode and React Suspense can cause multiple renders when hot updates are applied.
Most of these render correctly, including the final render that is visible to you.
But intermediate renders can sometimes use new loader data with old React components, which is where those errors come from.

We are continuing to investigate the underlying race condition to see if we can smooth that over.
In the meantime, if those console errors bother you, you can refresh the page whenever they occur.

##### HDR: performance

When the Remix compiler builds (and rebuilds) your app, you may notice a slight slowdown as the compiler needs to crawl the dependencies for each loader.
That way Remix can detect loader changes on rebuilds.

While the initial build slowdown is inherently a cost for HDR, we plan to optimize rebuilds so that there is no perceivable slowdown for HDR rebuilds.

[hmr_and_hdr]: https://www.youtube.com/watch?v=2c2OeqOX72s
[mental_model]: https://www.youtube.com/watch?v=zTrjaUt9hLo
[migrating]: https://www.youtube.com/watch?v=6jTL8GGbIuc
[legendary_dx]: https://www.youtube.com/watch?v=79M4vYZi-po
[loader]: ../route/loader
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[watch_paths]: ../file-conventions/remix-config#watchpaths
[react_keys]: https://react.dev/learn/rendering-lists#why-does-react-need-keys
[use_loader_data]: ../hooks/use-loader-data
[react_refresh]: https://github.com/facebook/react/tree/main/packages/react-refresh
[msw]: https://mswjs.io
[path_imports]: https://mui.com/material-ui/guides/minimizing-bundle-size/#option-one-use-path-imports
[bundle_analysis]: ../guides/performance
[manual_mode]: ../guides/manual-mode
[hmr]: ../discussion/hot-module-replacement
[remix-vite]: ../future/vite
[classic-remix-compiler]: ../future/vite#classic-remix-compiler-vs-remix-vite
