import http from "http";
import type { Request, Response } from "express";
import express from "express";
import morgan from "morgan";
import signalExit from "signal-exit";

import { BuildMode, BuildTarget } from "./build";
import { watch, write } from "./compiler";
import type { RemixConfig } from "./config";

export async function startDevServer(
  config: RemixConfig,
  {
    onListen
  }: {
    onListen?: () => void;
  } = {}
) {
  let requestHandler = createRequestHandler(config);

  let server = http.createServer(requestHandler);

  server.listen(config.devServerPort, onListen);

  signalExit(() => {
    server.close();
  });
}

function createRequestHandler(config: RemixConfig) {
  signalExit(
    watch(config, {
      mode: BuildMode.Development,
      target: BuildTarget.Server,
      manifestDir: config.serverBuildDirectory,
      async onBuildEnd(build) {
        await write(build, config.serverBuildDirectory);
        console.log(`Wrote server build to ${config.serverBuildDirectory}`);
      },
      onError(error) {
        console.error(error);
      }
    })
  );

  signalExit(
    watch(config, {
      mode: BuildMode.Development,
      target: BuildTarget.Browser,
      manifestDir: config.serverBuildDirectory,
      async onBuildEnd(build) {
        await write(build, config.browserBuildDirectory);
        console.log(`Wrote browser build to ${config.browserBuildDirectory}`);
      },
      onError(error) {
        console.error(error);
      }
    })
  );

  function handleRequest(_req: Request, res: Response) {
    res.status(200).send();
  }

  let app = express();

  app.disable("x-powered-by");

  app.use(morgan("dev"));

  app.get("*", handleRequest);

  return app;
}
