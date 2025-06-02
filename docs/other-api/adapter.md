---
title: "@remix-run/{adapter}"
order: 3
---

# Server Adapters

## Official Adapters

Idiomatic Remix apps can generally be deployed anywhere because Remix adapts the server's request/response to the [Web Fetch API][web-fetch-api]. It does this through adapters. We maintain a few adapters:

- `@remix-run/architect`
- `@remix-run/cloudflare-pages`
- `@remix-run/cloudflare-workers`
- `@remix-run/express`

These adapters are imported into your server's entry and are not used inside your Remix app itself.

If you initialized your app with `npx create-remix@latest` with something other than the built-in Remix App Server, you will note a `server/index.js` file that imports and uses one of these adapters.

<docs-info>If you're using the built-in Remix App Server, you don't interact with this API</docs-info>

Each adapter has the same API. In the future we may have helpers specific to the platform you're deploying to.

## Community Adapters

- [`@fastly/remix-server-adapter`][fastly-remix-server-adapter] — For [Fastly Compute][fastly-compute].
- [`@mcansh/remix-fastify`][remix-fastify] — For [Fastify][fastify].
- [`@mcansh/remix-raw-http`][remix-raw-http] — For a good old bare-bones Node.js server.
- [`@netlify/remix-adapter`][netlify-remix-adapter] — For [Netlify][netlify].
- [`@netlify/remix-edge-adapter`][netlify-remix-edge-adapter] — For [Netlify][netlify] Edge.
- [`@vercel/remix`][vercel-remix] — For [Vercel][vercel].
- [`remix-google-cloud-functions`][remix-google-cloud-functions] — For [Google Cloud][google-cloud-functions] and [Firebase][firebase-functions] functions.
- [`partymix`][partymix] — For [PartyKit][partykit].
- [`@scandinavianairlines/remix-azure-functions`][remix-azure-functions] — For [Azure Functions][azure-functions] and [Azure Static Web Apps][azure-static-web-apps].

## Creating an Adapter

### `createRequestHandler`

Creates a request handler for your server to serve the app. This is the ultimate entry point of your Remix application.

```ts
const {
  createRequestHandler,
} = require("@remix-run/{adapter}");
createRequestHandler({ build, getLoadContext });
```

Here's a full example with express:

```ts lines=[1-3,11-22]
const {
  createRequestHandler,
} = require("@remix-run/express");
const express = require("express");

const app = express();

// needs to handle all verbs (GET, POST, etc.)
app.all(
  "*",
  createRequestHandler({
    // `remix build` and `remix dev` output files to a build directory, you need
    // to pass that build to the request handler
    build: require("./build"),

    // Return anything you want here to be available as `context` in your
    // loaders and actions. This is where you can bridge the gap between Remix
    // and your server
    getLoadContext(req, res) {
      return {};
    },
  })
);
```

Here's an example with Architect (AWS):

```ts
const {
  createRequestHandler,
} = require("@remix-run/architect");
exports.handler = createRequestHandler({
  build: require("./build"),
});
```

Here's an example with the simplified Cloudflare Workers API:

```ts
import { createEventHandler } from "@remix-run/cloudflare-workers";

import * as build from "../build";

addEventListener("fetch", createEventHandler({ build }));
```

Here's an example with the lower-level Cloudflare Workers API:

```ts
import {
  createRequestHandler,
  handleAsset,
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

addEventListener("fetch", (event) => {
  try {
    event.respondWith(handleEvent(event));
  } catch (e: any) {
    if (process.env.NODE_ENV === "development") {
      event.respondWith(
        new Response(e.message || e.toString(), {
          status: 500,
        })
      );
    }

    event.respondWith(
      new Response("Internal Error", { status: 500 })
    );
  }
});
```

[web-fetch-api]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[fastly-remix-server-adapter]: https://github.com/fastly/remix-compute-js/tree/main/packages/remix-server-adapter
[fastly-compute]: https://developer.fastly.com/learning/compute/
[remix-google-cloud-functions]: https://github.com/penx/remix-google-cloud-functions
[google-cloud-functions]: https://cloud.google.com/functions
[firebase-functions]: https://firebase.google.com/docs/functions
[remix-fastify]: https://github.com/mcansh/remix-fastify
[fastify]: https://www.fastify.io
[remix-raw-http]: https://github.com/mcansh/remix-node-http-server
[netlify-remix-adapter]: https://github.com/netlify/remix-compute/tree/main/packages/remix-adapter
[netlify-remix-edge-adapter]: https://github.com/netlify/remix-compute/tree/main/packages/remix-edge-adapter
[netlify]: https://netlify.com
[vercel-remix]: https://github.com/vercel/remix/blob/main/packages/vercel-remix
[vercel]: https://vercel.com
[partykit]: https://partykit.io
[partymix]: https://github.com/partykit/partykit/tree/main/packages/partymix
[remix-azure-functions]: https://github.com/scandinavianairlines/remix-azure-functions
[azure-functions]: https://azure.microsoft.com/en-us/products/functions/
[azure-static-web-apps]: https://azure.microsoft.com/en-us/products/app-service/static
