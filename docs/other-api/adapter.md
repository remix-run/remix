---
title: "@remix-run/{adapter}"
order: 2
---

# Server Adapters

Idiomatic Remix apps can generally be deployed anywhere because Remix adapts the server's request/response to the [Web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). It does this through adapters. You can [build your own adapter](#custom-adapters), but we provide several for common deployment scenarios:

- `@remix-run/express`
- `@remix-run/architect`
- `@remix-run/vercel`
- `@remix-run/netlify`
- `@remix-run/cloudflare-workers`

These adapters are imported into your server's entry and is not used inside of your Remix app itself.

If you initialized your app with `npx create-remix@latest` with something other than the built-in Remix App Server, you will note a `server/index.js` file that imports and uses one of these adapters.

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

const app = express();

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
  for (const key in require.cache) {
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

## Custom Adapters

If you want to deploy Remix within a not-yet-supported framework/server, you'll need to write an adapter. This will allow the framework to hand off a request to Remix for processing.

Publishing your custom adapter as an NPM module will allow others to use it. If it includes templates, it can even be used by `create-remix` to bootstrap a new Remix app within that framework/server.

### Handling Requests and Responses

The adapter is responsible for passing a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) into the Remix request handler and then doing something with the eventual [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response).

For example, here's a simple adapter that takes a URL path, makes a Remix request, and then returns a status code:

```ts
import type { ServerBuild } from "@remix-run/server-runtime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import { installGlobals } from "@remix-run/node";
installGlobals();

// Build a request handler that takes a path as an argument and returns the status code
export function createRequestHandler(build: ServerBuild) {
  const handleRequest = createRemixRequestHandler(
    build,
    {}
  );

  return async function (path: string) {
    // Build a Request and let Remix process it, then do something with the Response
    const response = await handleRequest(
      new Request("http://localhost/" + path)
    );
    return response.status;
  };
}
```

For more real-world examples, check out the adapters that ship with Remix, e.g. [@remix-run/express](https://github.com/remix-run/remix/blob/main/packages/remix-express/index.ts) or [@remix-run/architect](https://github.com/remix-run/remix/blob/main/packages/remix-architect/index.ts)

To make your adapter consistent, we recommend you adhere to the same API as the other adapters (i.e. export your own `createRequestHandler`)

### Templating and `create-remix`

Custom server adapters can be used when generating a new app with `create-remix`. The `--server-type` flag allows you to specify the server template type. In addition to built-in templates like `remix` or `express`, it also works with package names and paths, e.g. `npx create-remix -s @mycool/remix-server-thingy` or `npx create-remix -s ../path/to/my-adapter-and-templates`.

The adapter's templates will be used as follows (where `lang: 'ts' | 'js'`, depending on what was chosen):

1. Files and directories under create-remix' [`_shared_${lang}`](https://github.com/remix-run/remix/tree/main/packages/create-remix/templates) directory are copied in
2. Files and directories under the package's `templates/shared` directory (if present) are copied in
3. Files and directories under the package's `templates/${lang}` directory (if present) are coped in

A file copied during a later step will normally overwrite the same file from an earlier one, though package.json gets merged across steps.
