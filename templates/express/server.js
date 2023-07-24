import * as fs from "node:fs";

import { createRequestHandler } from "@remix-run/express";
import { broadcastDevReady, installGlobals } from "@remix-run/node";
import chokidar from "chokidar";
import compression from "compression";
import express from "express";
import morgan from "morgan";

installGlobals();

const BUILD_PATH = "./build/index.js";
/**
 * @type { import('@remix-run/node').ServerBuild | Promise<import('@remix-run/node').ServerBuild> }
 */
let build = await import(BUILD_PATH);

//Swap in this if using Remix in CJS mode
// let build = require(BUILD_PATH);

const app = express();

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// Remix fingerprints its assets so we can cache forever.
app.use(
  "/build",
  express.static("public/build", { immutable: true, maxAge: "1y" })
);

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("public", { maxAge: "1h" }));

app.use(morgan("tiny"));

app.all(
  "*",
  process.env.NODE_ENV === "development"
    ? createDevRequestHandler()
    : createRequestHandler({
        build,
        mode: process.env.NODE_ENV,
      })
);

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  console.log(`Express server listening on port ${port}`);

  // send "ready" message to dev server
  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(build);
  }
});


// Create a request handler that watches for changes to the server build during development.
function createDevRequestHandler() {
  async function handleServerUpdate() {
    // 1. re-import the server build
    build = await reimportServer();

    // Add debugger to assist in v2 dev debugging
    if (build?.assets === undefined) {
      console.log(build.assets);
      debugger;
    }

    // 2. tell dev server that this app server is now up-to-date and ready
    broadcastDevReady(build);
  }

  chokidar
    .watch(BUILD_PATH, {
      // Chokidar settings to avoid certain race condition issues #6831
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200 },
   })
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

// ESM import cache busting
// Swap this out for the CJS require cache below if you switch to serverModuleFormat: "cjs" in remix.config
/**
 * @type {() => Promise<ServerBuild>}
 */
async function reimportServer() {
  const stat = fs.statSync(BUILD_PATH);

  // use a timestamp query parameter to bust the import cache
  return import(BUILD_PATH + "?t=" + stat.mtimeMs);
}


// // CJS require cache busting
// /**
//  * @type {() => Promise<ServerBuild>}
//  */
// async function reimportServer() {
//   // 1. manually remove the server build from the require cache
//   Object.keys(require.cache).forEach((key) => {
//     if (key.startsWith(BUILD_PATH)) {
//       delete require.cache[key];
//     }
//   });

//   // 2. re-import the server build
//   return require(BUILD_PATH);
// }

