---
title: "@remix-run/dev CLI (v2)"
order: 2
new: true
---

The Remix CLI comes from the `@remix-run/dev` package. It also includes the compiler. Make sure it is in your `package.json` `devDependencies` so it doesn't get deployed to your server.

To get a full list of available commands and flags, run:

```sh
npx @remix-run/dev -h
```

## `remix build`

Builds your app for production. This command will set `process.env.NODE_ENV` to `production` and minify the output for deployment.

```sh
remix build
```

### Options

| Option                                   | flag          | config | default |
| ---------------------------------------- | ------------- | ------ | ------- |
| Generate sourcemaps for production build | `--sourcemap` | N/A    | `false` |

## `remix dev`

Builds your app and spins up the Remix dev server alongside your app server.

The dev server will:

1. Set `NODE_ENV` to `development`
2. Watch your app code for changes and trigger rebuilds
3. Restart your app server whenever rebuilds succeed
4. Send code updates to the browser via Live Reload and HMR + Hot Data Revalidation

<docs-info>

What is "Hot Data Revalidation"?

Like HMR, HDR is a way of hot updating your app without needing to refresh the page.
That way you can keep your app state as your edits are applied in your app.
HMR handles client-side code updates like when you change the components, markup, or styles in your app.
Likewise, HDR handles server-side code updates.

That means any time your change a `loader` on your current page (or any code that your `loader` depends on), Remix will re-fetch data from your changed loader.
That way your app is _always_ up-to-date with the latest code changes, client-side or server-side.

To learn more about how HMR and HDR work together, check out [Pedro's talk at Remix Conf 2023][legendary-dx].

</docs-info>

### With `remix-serve`

Enable the v2 dev server:

```js filename=remix.config.js
module.exports = {
  future: {
    v2_dev: true,
  },
};
```

That's it!

### With custom app server

If you used a template to get started, hopefully it has integration with the v2 dev server out-of-the-box.
If not, you can follow these steps to integrate your project with `v2_dev`:

1. Enable the v2 dev server:

```js filename=remix.config.js
module.exports = {
  future: {
    v2_dev: true,
  },
};
```

2. Replace your dev scripts in `package.json` and use `-c` to specify your app server command:

```json
{
  "dev": "remix dev -c 'node ./server.js'"
}
```

3. Ensure `broadcastDevReady` is called when your app server is up and running:

```js filename=server.js lines=[12,25-27]
import path from "node:path";

import { broadcastDevReady } from "@remix-run/node";
import express from "express";

const BUILD_DIR = path.resolve(__dirname, "build");
const build = require(BUILD_DIR);

const app = express();

// ... code for setting up your express app goes here ...

app.all(
  "*",
  createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
  })
);

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

Why? `broadcastDevReady` uses `fetch` to send a ready message to the dev server,
but CloudFlare does not support async I/O like `fetch` outside of request handling.

</docs-info>

### Options

Options priority order is: 1. flags, 2. config, 3. defaults.

| Option          | flag               | config           | default                                           |
| --------------- | ------------------ | ---------------- | ------------------------------------------------- |
| Command         | `-c` / `--command` | `command`        | `remix-serve <server build path>`                 |
| No restart      | `--no-restart`     | `restart: false` | `restart: true`                                   |
| Scheme          | `--scheme`         | `scheme`         | `https` if TLS key/cert are set, otherwise `http` |
| Host            | `--host`           | `host`           | `localhost`                                       |
| Port            | `--port`           | `port`           | Dynamically chosen open port                      |
| TLS key         | `--tls-key`        | `tlsKey`         | N/A                                               |
| TLS certificate | `--tls-cert`       | `tlsCert`        | N/A                                               |

<docs-info>

The scheme/host/port options only affect the Remix dev server, and **do not affect your app server**.
Your app will run on your app server's normal URL.

You most likely won't want to configure the scheme/host/port for the dev server,
as those are implementation details used internally for hot updates.
They exist in case you need fine-grain control, for example Docker networking or using specific open ports.

</docs-info>

For example, to override the port used by the dev server via config:

```js filename=remix.config.js
module.exports = {
  future: {
    v2_dev: {
      port: 8001,
    },
  },
};
```

### Keep app server running across rebuilds

By default, the Remix dev server restarts your app server when rebuilds occur.
This is a simple way to ensure that your app server is up-to-date with the latest code changes.

If you'd like to opt-out of this behavior use the `--no-restart` flag:

```sh
remix dev --no-restart -c 'node ./server.js'
```

🚨 BUT that means you are now on the hook for applying changes to your running app server _and_ telling the dev server when those changes have been applied.

> With great power comes great responsibility.

Check out our [templates][templates] for examples on how to use `import` cache busting to apply code changes to your app server while it keeps running.

If you're using CJS but looking at an ESM template, you'll need to swap out `import` cache busting with `require` cache busting:

```diff
- const stat = fs.statSync(BUILD_DIR);
- build = import(BUILD_DIR + "?t=" + stat.mtimeMs);
+ for (const key in require.cache) {
+   if (key.startsWith(BUILD_DIR)) {
+     delete require.cache[key];
+   }
+ }
+ build = require(BUILD_DIR)
```

#### Pick up changes from other packages

If you are using a monorepo, you might want Remix to perform hot updates not only when your app code changes, but whenever you change code in any of your apps dependencies.

For example, you could have a UI library package (`packages/ui`) that is used within your Remix app (`packages/app`).
To pick up changes in `packages/ui`, you can configure [watchPaths][watch-paths] to include your packages.

#### Keep in-memory data and connections across rebuilds

Every time you re-import code to apply changes to your app server, that code will be run.
Rerunning each changed module works great in most cases, but sometimes you want to want to keep stuff around.

For example, it'd be nice if your app only connected to your database once and kept that connection around across rebuilds.
But since the connection is held in-memory, re-imports will wipe those out and cause your app to reconnect.

Luckily, there's a trick to get around this: use `global` as a cache for keeping things in-memory across rebuilds!
Here's a nifty utility adapted from [Jon Jensen's code][jenseng-code] for [his Remix Conf 2023 talk][jenseng-talk]:

```ts filename=app/utils/remember.ts
export function remember<T>(key: string, valueFactory: () => T) {
  const g = global as any;
  g.__singletons ??= {};
  g.__singletons[key] ??= valueFactory();
  return g.__singletons[key];
}
```

And here's how to use it to keep stuff around across rebuilds:

```ts filename=app/utils/db.server.ts
import { PrismaClient } from "@prisma/client";

import { remember } from "~/utils/remember";

// hard-code a unique key so we can look up the client when this module gets re-imported
export const db = remember("db", () => new PrismaClient());
```

### How to set up MSW

To use [Mock Service Worker][msw] in development, you'll need to:

1. Run MSW as part of your app server
2. Configure MSW to not mock internal "dev ready" messages to the dev server

For example, if you are using [binode][binode] to integrate with MSW,
make sure that the call to `binode` is within the `remix dev -c` subcommand.
That way, the MSW server will have access to the `REMIX_DEV_HTTP_ORIGIN` environment variable:

```json filename=package.json
{
  "scripts": {
    "dev": "remix dev -c 'npm run dev:app'",
    "dev:app": "binode --require ./mocks -- @remix-run/serve:remix-serve ./build"
  }
}
```

Next, you can use `REMIX_DEV_HTTP_ORIGIN` to let MSW forward internal "dev ready" messages on `/ping`:

```ts
import { rest } from "msw";

export const server = setupServer(
  rest.post(
    `${process.env.REMIX_DEV_HTTP_ORIGIN}/ping`,
    (req) => req.passthrough()
  )
  // ... other request handlers go here ...
);
```

### How to set up local HTTPS

For this example, let's use [mkcert][mkcert].
After you have it installed, make sure to:

- Create a local Certificate Authority if you haven't already done so
- Use `NODE_EXTRA_CA_CERTS` for Node compatibility

```sh
mkcert -install # create a local CA
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" # tell Node to use our local CA
```

Now, create the TLS key and certificate:

```sh
mkcert -key-file key.pem -cert-file cert.pem localhost
```

👆 You can change `localhost` to something else if you are using custom hostnames.

Next, use the `key.pem` and `cert.pem` to get HTTPS working locally with your app server.
This depends on what you are using for your app server.
For example, here's how you could use HTTPS with an Express server:

```ts filename=server.js
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

import express from "express";

const BUILD_DIR = path.resolve(__dirname, "build");
const build = require(BUILD_DIR);

const app = express();

// ... code setting up your express app goes here ...

const server = https.createServer(
  {
    key: fs.readFileSync("path/to/key.pem"),
    cert: fs.readFileSync("path/to/cert.pem"),
  },
  app
);

const port = 3000;
server.listen(port, () => {
  console.log(`👉 https://localhost:${port}`);

  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(build);
  }
});
```

Now that the app server is set up, you should be able to build and run your app in production mode with TLS.
To get the dev server to interop with TLS, you'll need to specify the TLS cert and key you created:

```sh
remix dev --tls-key=key.pem --tls-cert=cert.pem -c 'node ./server.js'
```

Alternatively, you can specify the TLS key and cert via the `v2_dev.tlsCert` and `v2_dev.tlsKey` config options.
Now your app server and dev server are TLS ready!

### Troubleshooting

#### HMR: hot updates losing app state

Hot Module Replacement is supposed to keep your app's state around between hot updates.
But in some cases React cannot distinguish between existing components being changed and new components being added.
[React needs `key`s][react-keys] to disambiguate these cases and track changes when sibling elements are modified.

Additionally, when adding or removing hooks, React Refresh treats that as a brand new component.
So if you add `useLoaderData` to your component, you may lose state local to that component.

These are limitations of React and [React Refresh][react-refresh], not Remix.

#### HDR: every code change triggers HDR

Hot Data Revalidation detects loader changes by trying to bundle each loader and then fingerprinting the content for each.
It relies on treeshaking to determine whether your changes affect each loader or not.

To ensure that treeshaking can reliably detect changes to loaders, make sure you declare that your app's package is side-effect free:

```json filename=package.json
{
  "sideEffects": false
}
```

#### HDR: harmless console errors when loader data is removed

When you delete a loader or remove some of the data being returned by that loader, your app should be hot updated correctly.
But you may notice console errors logged in your browser.

React strict-mode and React Suspense can cause multiple renders when hot updates are applied.
Most of these render correctly, including the final render that is visible to you.
But intermediate renders can sometimes use new loader data with old React components, which is where those errors come from.

We are continuing to investigate the underlying race condition to see if we can smooth that over.
In the meantime, if those console errors bother you, you can refresh the page whenever they occur.

#### HDR: performance

When the v2 dev server builds (and rebuilds) your app, you may notice a slight slowdown as the dev server needs to crawl the dependencies for each loader.
That way the dev server can detect loader changes on rebuilds.

While the initial build slowdown is inherently a cost for HDR, we plan to optimize rebuilds so that there is no perceivable slowdown for HDR rebuilds.

[legendary-dx]: https://www.youtube.com/watch?v=79M4vYZi-po
[templates]: https://github.com/remix-run/remix/tree/main/templates
[watch-paths]: https://remix.run/docs/en/1.17.1/file-conventions/remix-config#watchpaths
[jenseng-code]: https://github.com/jenseng/abuse-the-platform/blob/main/app/utils/singleton.ts
[jenseng-talk]: https://www.youtube.com/watch?v=lbzNnN0F67Y
[react-keys]: https://react.dev/learn/rendering-lists#why-does-react-need-keys
[react-refresh]: https://github.com/facebook/react/tree/main/packages/react-refresh
[binode]: https://github.com/kentcdodds/binode
[msw]: https://mswjs.io/
[mkcert]: https://github.com/FiloSottile/mkcert
