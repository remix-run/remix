---
title: Manual Dev Server
---

# Manual mode

<docs-warning>This guide is only relevant when using the [Classic Remix Compiler][classic-remix-compiler].</docs-warning>

By default, `remix dev` drives like an automatic.
It keeps your app server up-to-date with the latest code changes by automatically restarting the app server whenever file changes are detected in your app code.
This is a simple approach that stays out of your way, and we think will work well for most apps.

But if app server restarts are slowing you down, you can take the wheel and drive `remix dev` like a manual:

```shellscript nonumber
remix dev --manual -c "node ./server.js"
```

That means learning how to use the clutch to shift gears.
It also means you might stall while your getting your bearings.
It takes a bit more time to learn and its more code for you to maintain.

> With great power comes great responsibility.

We don't think its worth it unless you're feeling some pain with the default automatic mode.
But if you are, Remix has got you covered.

## Mental model for `remix dev`

Before you start drag racing, it helps to understand how Remix works under the hood.
It's especially important to understand that `remix dev` spins up _not one, but two processes_: the Remix compiler and your app server.

Check out our video ["Mental model for the new dev flow 🧠"][mental_model] for more details.

<docs-info>

Previously, we referred to the Remix compiler as the "new dev server" or the "v2 dev server".
Technically, `remix dev` is a thin layer around the Remix compiler that _does_ include a tiny server with a single endpoint (`/ping`) for coordinating hot updates.
But thinking of `remix dev` as a "dev server" is unhelpful and wrongly implies that it is replacing your app server in dev.
Rather than replacing your app server, `remix dev` runs your app server _alongside_ the Remix compiler, so you get the best of both worlds:

- Hot updates managed by the Remix compiler
- Real production code paths running in dev within your app server

</docs-info>

## `remix-serve`

The Remix App Server (`remix-serve`) comes with support for manual mode out of the box:

```sh
remix dev --manual
```

<docs-info>

If you are running `remix dev` without the `-c` flag, then you are implicitly using `remix-serve` as your app server.

</docs-info>

No need to learn to drive stick, since `remix-serve` has a built-in sports mode that automatically shifts gears for you more aggressively at higher RPMs.
Ok, I think we're stretching this car metaphor. 😅

In other words, `remix-serve` knows how to reimport server code changes _without_ needing to restart itself.
But if you are using `-c` to run your own app server, read on.

## Learning to drive stick

When you switch on manual mode with `--manual`, you take on some new responsibilities:

1. Detect when server code changes are available
2. Re-import code changes while keeping the app server running
3. Send "ready" message to the Remix compiler _after_ those changes are picked up

Re-importing code changes turns out to be tricky because JS imports are cached.

```js
import fs from "node:fs";

const original = await import("./build/index.js");
fs.writeFileSync("./build/index.js", someCode);
const changed = await import("./build/index.js");
//    ^^^^^^^ this will return the original module from the import cache without the code changes
```

You need some way to bust the import cache when you want to re-import modules with code changes.
Also importing modules is different between CommonJS (`require`) and ESM (`import`) which makes things even more complicated.

<docs-warning>

If you are using `tsx` or `ts-node` to run your `server.ts`, those tools may be transpiling your ESM Typescript code to CJS Javascript code.
In this case, you'll need to use CJS cache busting in your `server.ts` even though the rest of your server code uses `import`s.

What matters here is how your server code is _executed_ not how its _written_.

</docs-warning>

### 1.a CJS: `require` cache busting

CommonJS uses `require` for imports, giving you direct access to the `require` cache.
That lets you bust the cache for _just_ the server code when rebuilds occur.

For example, here's how to bust the `require` cache for the Remix server build:

```js
const path = require("node:path");

/** @typedef {import('@remix-run/node').ServerBuild} ServerBuild */

const BUILD_PATH = path.resolve("./build/index.js");
const VERSION_PATH = path.resolve("./build/version.txt");
const initialBuild = reimportServer();

/**
 * @returns {ServerBuild}
 */
function reimportServer() {
  // 1. manually remove the server build from the require cache
  Object.keys(require.cache).forEach((key) => {
    if (key.startsWith(BUILD_PATH)) {
      delete require.cache[key];
    }
  });

  // 2. re-import the server build
  return require(BUILD_PATH);
}
```

<docs-info>

The `require` cache keys are _absolute paths_ so make sure you resolve your server build path to an absolute path!

</docs-info>

### 1.b ESM: `import` cache busting

Unlike CJS, ESM doesn't give you direct access to the import cache.
To work around this, you can use a timestamp query parameter to force ESM to treat the import as a new module.

```js
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

/** @typedef {import('@remix-run/node').ServerBuild} ServerBuild */

const BUILD_PATH = path.resolve("./build/index.js");
const VERSION_PATH = path.resolve("./build/version.txt");
const initialBuild = await reimportServer();

/**
 * @returns {Promise<ServerBuild>}
 */
async function reimportServer() {
  const stat = fs.statSync(BUILD_PATH);

  // convert build path to URL for Windows compatibility with dynamic `import`
  const BUILD_URL = url.pathToFileURL(BUILD_PATH).href;

  // use a timestamp query parameter to bust the import cache
  return import(BUILD_URL + "?t=" + stat.mtimeMs);
}
```

<docs-warning>

In ESM, there's no way to remove entries from the `import` cache.
While our timestamp workaround works, it means that the `import` cache will grow over time which can eventually cause Out of Memory errors.

If this happens, you can restart `remix dev` to start again with a fresh import cache.
In the future, Remix may pre-bundle your dependencies to keep the import cache small.

</docs-warning>

### 2. Detecting server code changes

Now that you have a way to bust the import cache for CJS or ESM, it's time to put that to use by dynamically updating the server build within your app server.
To detect when the server code changes, you can use a file watcher like [chokidar][chokidar]:

```js
import chokidar from "chokidar";

async function handleServerUpdate() {
  build = await reimportServer();
}

chokidar
  .watch(VERSION_PATH, { ignoreInitial: true })
  .on("add", handleServerUpdate)
  .on("change", handleServerUpdate);
```

### 3. Sending the "ready" message

Now's a good time to double-check that your app server is sending "ready" messages to the Remix compiler when it initially spins up:

```js filename=server.js lines=[5-7]
const port = 3000;
app.listen(port, async () => {
  console.log(`Express server listening on port ${port}`);

  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(initialBuild);
  }
});
```

In manual mode, you also need to send "ready" messages whenever you re-import the server build:

```js lines=[4-5]
async function handleServerUpdate() {
  // 1. re-import the server build
  build = await reimportServer();
  // 2. tell Remix that this app server is now up-to-date and ready
  broadcastDevReady(build);
}
```

### 4. Dev-aware request handler

Last step is to wrap all of this up in a development mode request handler:

```js
/**
 * @param {ServerBuild} initialBuild
 */
function createDevRequestHandler(initialBuild) {
  let build = initialBuild;
  async function handleServerUpdate() {
    // 1. re-import the server build
    build = await reimportServer();
    // 2. tell Remix that this app server is now up-to-date and ready
    broadcastDevReady(build);
  }

  chokidar
    .watch(VERSION_PATH, { ignoreInitial: true })
    .on("add", handleServerUpdate)
    .on("change", handleServerUpdate);

  // wrap request handler to make sure its recreated with the latest build for every request
  return async (req, res, remix) => {
    try {
      return createRequestHandler({
        build,
        mode: "development",
      })(req, res, remix);
    } catch (error) {
      remix(error);
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
    ? createDevRequestHandler(initialBuild)
    : createRequestHandler({ build: initialBuild })
);
```

For complete app server code examples, check our [templates][templates] or [community examples][community_examples].

## Keeping in-memory server state across rebuilds

When server code is re-imported, any server-side in-memory state is lost.
That includes things like database connections, caches, in-memory data structures, etc.

Here's a utility that remembers any in-memory values you want to keep around across rebuilds:

```ts filename=app/utils/singleton.server.ts
// Borrowed & modified from https://github.com/jenseng/abuse-the-platform/blob/main/app/utils/singleton.ts
// Thanks @jenseng!

export const singleton = <Value>(
  name: string,
  valueFactory: () => Value
): Value => {
  const g = global as any;
  g.__singletons ??= {};
  g.__singletons[name] ??= valueFactory();
  return g.__singletons[name];
};
```

For example, to reuse a Prisma client across rebuilds:

```ts filename=app/db.server.ts
import { PrismaClient } from "@prisma/client";

import { singleton } from "~/utils/singleton.server";

// hard-code a unique key so we can look up the client when this module gets re-imported
export const db = singleton(
  "prisma",
  () => new PrismaClient()
);
```

There is also a handy [`remember` utility][remember] that can help out here if you prefer to use that.

[mental_model]: https://www.youtube.com/watch?v=zTrjaUt9hLo
[chokidar]: https://github.com/paulmillr/chokidar
[templates]: https://github.com/remix-run/remix/blob/main/templates
[community_examples]: https://github.com/xHomu/remix-v2-server
[remember]: https://npm.im/@epic-web/remember
[classic-remix-compiler]: ./vite#classic-remix-compiler-vs-remix-vite
