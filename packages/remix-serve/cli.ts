import "./env";
import path from "path";
import os from "os";
import arg from "arg";

import { createApp } from "./index";

let args = arg({
  "--server": String,
  "-s": "--server",
  "--assets": String,
  "-a": "--assets",
  "--browser-assets": String,
  "--public-path": String,
  "--port": Number,
  "-p": "--port",
  "--help": Boolean,
  "-h": "--help",
});

if (args["--help"]) {
  console.log(`
  --server: serverBuildPath or serverBuildDirectory in your remix.config.js
  --assets: assetsBuildDirectory in your remix.config.js
  --browser-assets: publicPath in your remix.config.js
  --public-path: "public" directory
  --port: port to listen on
  --help: show this help
  `);
  process.exit(0);
}

let buildPathArg = args["--server"];
let publicPath = args["--public-path"];
let assetsBuildDirectory = args["--assets"];
let browserAssetsPath = args["--browser-assets"];
let port = args["--port"] || process.env.PORT ? Number(process.env.PORT) : 3000;
if (Number.isNaN(port)) {
  port = 3000;
}

if (!buildPathArg) {
  buildPathArg = process.argv[2];

  console.error(`
  This behavior is deprecated. Please update to the following command:
  remix-serve -s ${buildPathArg}`);

  if (!buildPathArg) {
    console.error(`
    Usage: remix-serve -s <build-dir>`);
    process.exit(1);
  }
}

let buildPath = path.resolve(process.cwd(), buildPathArg);

let onListen = () => {
  let address =
    process.env.HOST ||
    Object.values(os.networkInterfaces())
      .flat()
      .find((ip) => ip?.family === "IPv4" && !ip.internal)?.address;

  if (!address) {
    console.log(`Remix App Server started at http://localhost:${port}`);
  } else {
    console.log(
      `Remix App Server started at http://localhost:${port} (http://${address}:${port})`
    );
  }
};

let app = createApp(buildPath, process.env.NODE_ENV, {
  assetsBuildDirectory,
  browserAssetsPath,
  publicPath,
});
let server = process.env.HOST
  ? app.listen(port, process.env.HOST, onListen)
  : app.listen(port, onListen);

["SIGTERM", "SIGINT"].forEach((signal) => {
  process.once(signal, () => server?.close(console.error));
});
