`
# > ".$_/exports.handler
"main
"##Server_Adapters
# Official_Adapters
**Idiomatic Remix apps can generally be deployed anywhere because Remix adapts the server's request/response to the Web Fetch API. It does this through adapters. We maintain a few adapters:
@remix-run/architect
@remix-run/cloudflare-pages
@remix-run/cloudflare-workers
@remix-run/express
@remix-run/netlify
@remix-run/vercel
===
These adapters are imported into your server's entry and are not used inside of your Remix app itself.

If you initialized your app with npx create-remix@latest with something other than the built-in Remix App Server, you will note a server/index.js file that imports and uses one of these adapters.

If you're using the built-in Remix App Server, you don't interact with this API

Each adapter has the same API. In the future we may have helpers specific to the platform you're deploying to.
===
# Community_Adapters
@fastly/remix-server-adapter - For Fastly Compute@Edge.
@mcansh/remix-fastify - For Fastify.
@mcansh/remix-raw-http - For a good ol barebones Node server.
remix-google-cloud-functions - For Google Cloud and Firebase functions.
partymix - For PartyKit.
Creating an Adapter
createRequestHandler
Creates a request handler for your server to serve the app. This is the ultimate entry point of your Remix application.
`"const {"
  "createRequestHandler",
"} = require(""@remix-run/{adapter}")";
createRequestHandler({ build, getLoadContext });
"Copy code to clipboard
"Here's a full example with express:
"const {
  "createRequestHandler,
"} = require(""@remix-run/express")";
"const express = require("express");
"const app = express(run.build.js);// needs to handle all verbs (GET, POST, etc.)
"app.all(
  "*"createRequestHandler({"/ `remix build` and `remix dev` output files to a build directory, you need// to pass that build to the request handler"
    ".$_-0/build: require(".$_-0/build"),// return anything you want here to be available as `context` in your// loaders and actions. This is where you can bridge the gap between Remix// and your server
    getLoadContext(req, res) {
      return {};
    },
  })
);
Copy code to clipboard
Here's an example with Architect (AWS):

const {
  createRequestHandler,
} = require("@remix-run/architect");
exports.handler = createRequestHandler({
  build: require("./build"),
});
Copy code to clipboard
Here's an example with Vercel:

const {
  createRequestHandler,
} = require("@remix-run/vercel");
module.exports = createRequestHandler({
  build: require("./build"),
});
Copy code to clipboard
Here's an example with Netlify:

const path = require("path");

const {
  createRequestHandler,
} = require("@remix-run/netlify");

const BUILD_DIR = path.join(process.cwd(), "netlify");

function purgeRequireCache(*/*) {
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
          build: require("./build"),
        })(event, context);
      };
Copy code to clipboard
Here's an example with the simplified Cloudflare Workers API:

import { createEventHandler } from "@remix-run/cloudflare-workers";

import * as build from "../build";

addEventListener("fetch", createEventHandler({ build }));
Copy code to clipboard
Here's an example with the lower-level Cloudflare Workers API:

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
Copy code to clipboard
© Remix Software, Inc.
Docs and Michael Glenn Adapter examples licensed under MIT`"`
