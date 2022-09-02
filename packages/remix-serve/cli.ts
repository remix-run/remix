import "./env";
import path from "path";
import os from "os";
import { type Express } from "express";

import { createApp as createDefaultApp } from "./index";

let port = process.env.PORT ? Number(process.env.PORT) : 3000;
if (Number.isNaN(port)) port = 3000;

let buildPathArg = process.argv[2];
let serverEntryFile = process.argv[3];

if (!buildPathArg) {
  console.error(`
  Usage: remix-serve <build-dir> [server-entry-file]`);
  process.exit(1);
}

let buildPath = path.resolve(process.cwd(), buildPathArg);
let build = require(buildPath);
let { createApp, createServer } = getServerEntry({ serverEntryFile });
let app = createApp(
  buildPath,
  process.env.NODE_ENV,
  build.publicPath,
  build.assetsBuildDirectory
);
let server = createServer(app, port);

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.once(signal, () => server?.close(console.error));
});

function getServerEntry(config: { serverEntryFile: string }): {
  createApp: typeof createDefaultApp;
  createServer: typeof createDefaultServer;
} {
  if (config.serverEntryFile) {
    let entry = require(path.resolve(serverEntryFile));
    return {
      createApp: entry.createApp,
      createServer: entry.createServer ?? createDefaultServer,
    };
  }
  return {
    createApp: createDefaultApp,
    createServer: createDefaultServer,
  };
}
function createDefaultServer(app: Express, port: number) {
  let onListen = () => {
    let address =
      process.env.HOST ||
      Object.values(os.networkInterfaces())
        .flat()
        .find((ip) => String(ip?.family).includes("4") && !ip?.internal)
        ?.address;

    if (!address) {
      console.log(`Remix App Server started at http://localhost:${port}`);
    } else {
      console.log(
        `Remix App Server started at http://localhost:${port} (http://${address}:${port})`
      );
    }
  };

  let server = process.env.HOST
    ? app.listen(port, process.env.HOST, onListen)
    : app.listen(port, onListen);
  return server;
}
