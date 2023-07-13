---
title: Development Performance
---

## Bundle analysis

Remix outputs metafiles to the server build directory (`build/` by default) so you can analyze your bundle size and composition.

- `metafile.css.json` : Metafile for the CSS bundle
- `metafile.js.json` : Metafile for the browser JS bundle
- `metafile.server.json` : Metafile for the serve JS bundle

Remix uses esbuild's metafile format so you can directly upload those files to [https://esbuild.github.io/analyze/][https-esbuild-github-io-analyze] to visualize your bundle.

## Path imports

Currently, when Remix rebuilds your app, the compiler has to process your app code along with any of its dependencies.
The compiler treeshakes unused code from app so that you don't ship any unused code to browser and so that you keep your server as slim as possible.
But the compiler still needs to _crawl_ all the code to know what to keep and what to treeshake away.

In short, this means that the way you do imports and exports can have a big impact on how long it takes to rebuild your app.
For example, if you are using a library like Material UI or AntD you can likely speed up your builds by using [path imports][path-imports]:

```diff
- import { Button, TextField } from '@mui/material';
+ import Button from '@mui/material/Button';
+ import TextField from '@mui/material/TextField';
```

In the future, Remix could pre-bundle dependencies in development to avoid this problem entirely.
But today, you can help the compiler out by using path imports.

## Manual mode

By default, `remix dev` drives like an automatic.
It keeps your app server up-to-date with the latest code changes by automatically restarting the app server whenever file changes are detected in your app code.
This is a simple approach that stays out of your way and we think will work well for most apps.

But if app server restarts are slowing you down, you can take the wheel and drive `remix dev` like a manual:

```sh
remix dev --manual -c "node ./server.js"
```

That means learning how to use the clutch to shift gears.
It also means you might stall while your getting your bearings.
It takes a bit more time to learn and its more code for you to maintain.

> With great power comes great responsibility.

We don't think its worth it unless you're feeling some pain with the default automatic mode.
But if you are, Remix has got you covered.

### Mental model for `remix dev`

Before you start drag racing, it helps to understand how Remix works under the hood.
It's especially important to understand that `remix dev` spins up _not one, but two servers_: the dev server and the app server.

The dev server is a glorified compiler running in watch mode.
**The browser _never_ sends requests to the dev server.**
You probably shouldn't care what port it runs on.

Check out our video ["Mental model for the new dev server 🧠"][mental-model] for more details.

### Learning to drive stick

When you switch on manual mode with `--manual`, you take on some new responsibilities:

1. Detect when server code changes are available
2. Re-import code changes while keeping the app server running
3. Send "ready" message to dev server _after_ those changes are picked up

Re-importing code changes turns out to be tricky because JS imports are cached.

```js
import fs from "node:fs";

const original = await import("./build/index.js");
fs.writeFileSync("./build/index.js", someCode);
const changed = await import("./build/index.js");
//  ^^^^^^^ this will return the original module from the import cache without the code changes
```

You need some way to bust the import cache when you want to re-import modules with code changes.
Also importing modules is different between CommonJS (`require`) and ESM (`import`) which makes things even more complicated.

#### 1.a CJS: `require` cache busting

CommonJS uses `require` for imports, giving you direct access to the `require` cache.
That lets you bust the cache for _just_ the server code when rebuilds occur.

For example, here's how to bust the `require` cache for the Remix server build:

```js
const path = require("node:path");

/**
 * @typedef {import('@remix-run/node').ServerBuild} ServerBuild
 */

const BUILD_PATH = path.resolve("./build/index.js");

/**
 * Initial build
 * @type {ServerBuild}
 */
let build = require(BUILD_PATH);

/**
 * @type {() => ServerBuild}
 */
const reimportServer = () => {
  // 1. manually remove the server build from the require cache
  Object.keys(require.cache).forEach((key) => {
    if (key.startsWith(BUILD_PATH)) {
      delete require.cache[key];
    }
  });

  // 2. re-import the server build
  return require(BUILD_PATH);
};

// to update your app server with new code changes:
build = reimportServer();
```

<docs-info>

The `require` cache keys are _absolute paths_ so make sure you resolve your server build path to an absolute path!

</docs-info>

#### 1.b ESM: `import` cache busting

Unlike CJS, ESM doesn't give you direct access to the import cache.
To workaround this, you can use a timestamp query parameter to force ESM to treat the import as a new module.

```js
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * @typedef {import('@remix-run/node').ServerBuild} ServerBuild
 */

const BUILD_PATH = "./build/index.js";

/**
 * Initial build
 * @type {ServerBuild}
 */
let build = await import(BUILD_PATH);

/**
 * @type {() => Promise<ServerBuild>}
 */
const reimportServer = async () => {
  const stat = fs.statSync(BUILD_PATH);

  // use a timestamp query parameter to bust the import cache
  return import(BUILD_PATH + "?t=" + stat.mtimeMs);
};

// to update your app server with new code changes:
build = await reimportServer();
```

<docs-warning>

In ESM, there's no way to remove entries from the `import` cache.
While our timestamp workaround works, it means that the `import` cache will grow over time which can eventually cause Out of Memory errors.

If this happens, you can restart the dev server to restart with a fresh import cache.
In the future, Remix may pre-bundle your dependencies to keep the import cache small.

</docs-warning>

#### 2. Detecting server code changes

Now that you have a way to bust the import cache for CJS or ESM, its time to put that to use by dynamically updating the server build within your app server.
To detect when the server code changes, you can use a file watcher like [chokidar][chokidar]:

```js
import chokidar from "chokidar";

async function handleServerUpdate() {
  build = await reimportServer();
}

chokidar
  .watch(BUILD_PATH, { ignoreInitial: true })
  .on("add", handleServerUpdate)
  .on("change", handleServerUpdate);
```

#### 3. Sending "ready" message to dev server

Now's a good time to double-check that your app server is sending "ready" messages to the dev server when it initially spins up:

```js filename=server.js lines=[5-7]
const port = 3000;
app.listen(port, async () => {
  console.log(`Express server listening on port ${port}`);

  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(build);
  }
});
```

In manual mode, you also need to send "ready" messages whenever you re-import the server build:

```js lines=[4-5]
async function handleServerUpdate() {
  // 1. re-import the server build
  build = await reimportServer();
  // 2. tell dev server that this app server is now up-to-date and ready
  broadcastDevReady(build);
}
```

#### 4. Dev-aware request handler

Last step is to wrap all of this up in a development mode request handler:

```js
function createDevRequestHandler() {
  async function handleServerUpdate() {
    // 1. re-import the server build
    build = await reimportServer();
    // 2. tell dev server that this app server is now up-to-date and ready
    broadcastDevReady(build);
  }

  chokidar
    .watch(BUILD_PATH, { ignoreInitial: true })
    .on("add", handleServerUpdate)
    .on("change", handleServerUpdate);

  // wrap request handler to make sure its recreated with the latest build for every request
  return async (req, res, next) => {
    try {
      return createRequestHandler({
        build,
        mode: "development",
      })(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
```

Awesome!
Now let's plug in our new manual transmission when running in development mode:

```js filename=server.js
app.all(
  "*",
  process.env.NODE_ENV === "development"
    ? createDevRequestHandler()
    : createRequestHandler({
        build,
        mode: process.env.NODE_ENV,
      })
);
```

For complete app server code examples, check out the [express template][express-template] or [community examples][community-examples].

### Keeping in-memory server state across rebuilds

When server code is re-imported, any server-side in-memory state is lost.
That includes things like database connections, caches, in-memory data structures, etc.

Here's a utility that remembers any in-memory values you want to keep around across rebuilds:

```ts filename=app/utils/remember.ts
// adapted from https://github.com/jenseng/abuse-the-platform/blob/main/app/utils/singleton.ts
// thanks @jenseng!

export function remember<T>(
  key: string,
  getValue: () => T
) {
  const g = global as any;
  g.__remember ??= {};
  g.__remember[key] ??= getValue();
  return g.__remember[key];
}
```

For example, to reuse a Prisma client across rebuilds:

```ts filename=app/db.server.ts
import { PrismaClient } from "@prisma/client";

import { remember } from "~/utils/remember";

// hard-code a unique key so we can look up the client when this module gets re-imported
export const db = remember("db", () => new PrismaClient());
```

[path-imports]: https://mui.com/material-ui/guides/minimizing-bundle-size/#option-one-use-path-imports
[mental-model]: https://www.youtube.com/watch?v=zTrjaUt9hLo
[express]: https://expressjs.com/
[chokidar]: https://github.com/paulmillr/chokidar
[express-template]: https://github.com/remix-run/remix/blob/main/templates/express/server.js
[community-examples]: https://github.com/xHomu/remix-v2-server
[https-esbuild-github-io-analyze]: https://esbuild.github.io/analyze
