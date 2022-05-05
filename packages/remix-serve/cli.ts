import "./env";
import path from "path";
import os from "os";
import { readConfig } from "@remix-run/config";

import { createApp } from "./index";

async function cli() {
  let port = Number.parseInt(process.env.PORT || "3000", 10);
  if (Number.isNaN(port)) {
    port = 3000;
  }

  let buildPathArg = process.argv[2];

  if (!buildPathArg) {
    console.error(`
    Usage: remix-serve <build-dir>`);
    process.exit(1);
  }

  let buildPath = path.resolve(process.cwd(), buildPathArg);

  let config = await readConfig(buildPath);

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

  let app = createApp(config);

  let server = process.env.HOST
    ? app.listen(port, process.env.HOST, onListen)
    : app.listen(port, onListen);

  ["SIGTERM", "SIGINT"].forEach((signal) => {
    process.once(signal, () => server?.close(console.error));
  });
}

cli()
  .then(() => {
    process.exit(0);
  }, (error) => {
    console.error(error);
    process.exit(1);
  });
