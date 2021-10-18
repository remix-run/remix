---
title: "@remix-run/{adapter}"
---

Idiomatic Remix apps can be deployed anywhere because Remix adapt's the server's request/response to the [Web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). It does this through adapters. We maintain a few adapters:

- `@remix-run/express`
- `@remix-run/architect`
- `@remix-run/vercel`
- `@remix-run/netlify`
- `@remix-run/cloudflare-workers`

These adapters are imported into your server's entry and is not used inside of your Remix app itself.

If you intialized your app with `npm init remix` with something other than the built-in Remix App Server, you will note a `server/index.js` file that imports and uses one of these adapters.

<docs-info>If you're using the built-in Remix App Server, you don't interact with this API</docs-info>

Each adapter has the same API. In the future we may have helpers specific to the platform you're deploying to.

## `createRequestHandler`

Creates a request handler for your server to serve the app. This is the ultimate entry point of your Remix application.

```ts
const {
  createRequestHandler
} = require("@remix-run/{adapter}");
createRequestHandler({ build, getLoadContext });
```

Here's a full example with express:

```ts [2, 9-20]
const express = require("express");
const {
  createRequestHandler
} = require("@remix-run/express");

let app = express();

// needs to handle all verbs (GET, POST, etc.)
app.all(
  "*",
  createRequestHandler({
    // `remix build` and `remix dev` output files to a build directory, you need
    // to pass that build to the request handler
    build: require("./build"),

    // return anything you want here to be available as `context` in your
    // loaders and actions. This is where you can bridge the gap between Remix
    // and your server
    getLoadContext(req, res) {
      return {};
    }
  })
);
```

Here's an example with Architect (AWS):

```ts
const {
  createRequestHandler
} = require("@remix-run/architect");
exports.handler = createRequestHandler({
  build: require("./build")
});
```

Here's an example with Vercel:

```ts
const {
  createRequestHandler
} = require("@remix-run/vercel");
module.exports = createRequestHandler({
  build: require("./build")
});
```

Here's an example with Netlify:

```ts
const path = require("path");
const {
  createRequestHandler
} = require("@remix-run/netlify");

const BUILD_DIR = path.join(process.cwd(), "netlify");

function purgeRequireCache() {
  // purge require cache on requests for "server side HMR" this won't let
  // you have in-memory objects between requests in development,
  // netlify typically does this for you, but we've found it to be hit or
  // miss and some times requires you to refresh the page after it auto reloads
  // or even have to restart your server
  for (let key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      delete require.cache[key];
    }
  }
}

exports.handler =
  process.env.NODE_ENV === "production"
    ? createRequestHandler({ build: require("./build") })
    : (event, context) => {
        purgeRequireCache();
        return createRequestHandler({
          build: require("./build")
        })(event, context);
      };
```

Here's an example with the simplified Cloudflare Workers API:

```ts
import { createEventHandler } from "@remix-run/cloudflare-workers";

import * as build from "../build";

addEventListener("fetch", createEventHandler({ build }));
```

Here's an example with the lower level Cloudflare Workers API:

```ts
import {
  createRequestHandler,
  handleAsset
} from "@remix-run/cloudflare-workers";

import * as build from "../build";

const handleRequest = createRequestHandler({ build });

const handleEvent = async (event: FetchEvent) => {
  let response = await handleAsset(event, build);

  if (!response) {
    response = await handleRequest(event);
  }

  return response;
};

addEventListener("fetch", event => {
  try {
    event.respondWith(handleEvent(event));
  } catch (e: any) {
    if (process.env.NODE_ENV === "development") {
      event.respondWith(
        new Response(e.message || e.toString(), {
          status: 500
        })
      );
    }

    event.respondWith(
      new Response("Internal Error", { status: 500 })
    );
  }
});
```
