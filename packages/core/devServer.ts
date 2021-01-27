import http from "http";
import path from "path";
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
  let serverBuildStart: number = 0;
  let browserBuildStart: number = 0;

  signalExit(
    watch(config, {
      mode: BuildMode.Development,
      target: BuildTarget.Server,
      manifestDir: config.serverBuildDirectory,
      onBuildStart() {
        console.log("Building Remix...");
        serverBuildStart = Date.now();
      },
      async onBuildEnd(build) {
        await write(build, config.serverBuildDirectory);
        let dir = path.relative(process.cwd(), config.serverBuildDirectory);
        let time = Date.now() - serverBuildStart;
        console.log(`Wrote server build to ./${dir} in ${time}ms`);
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
      onBuildStart() {
        browserBuildStart = Date.now();
      },
      async onBuildEnd(build) {
        await write(build, config.browserBuildDirectory);
        let dir = path.relative(process.cwd(), config.browserBuildDirectory);
        let time = Date.now() - browserBuildStart;
        console.log(`Wrote browser build to ./${dir} in ${time}ms`);
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
