---
title: "@remix-run/{adapter}"
---

Idiomatic Remix apps can be deployed anywhere because Remix adapt's the server's request/response to the [Web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). It does this through adapters. We maintain a few adapters:

- `@remix-run/express`
- `@remix-run/architect`
- `@remix-run/vercel`

We will be adding a few more eventually:

- `@remix-run/cf-workers`
- `@remix-run/netlify`

These adapters are imported into your server's entry and is not used inside of your Remix app itself.

If you intialized your app with `npm init remix` with something other than the built-in Remix App Server, you will note a `server/index.js` file that imports and uses one of these adapters.

<docs-info>If you're using the built-in Remix App Server, you don't interact with this API</docs-info>

Each adapter has the same API. In the future we may have helpers specific to the platform you're deploying to.

## `createRequestHandler`

Creates a request handler for your server to serve the app. This is the ultimate entry point of your Remix application.

```ts
const {
  createRequestHandler,
} = require("@remix-run/{adapter}");
createRequestHandler({ build, getLoadContext });
```

Here's a full example with express:

```ts [2, 9-20]
const express = require("express");
const {
  createRequestHandler,
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
    },
  })
);
```

Here's an example with Architect (AWS).

```ts
const {
  createRequestHandler,
} = require("@remix-run/architect");
exports.handler = createRequestHandler({
  build: require("./build"),
});
```

## Starter Templates
