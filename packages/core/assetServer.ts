import http from "http";
import path from "path";
import cors from "cors";
import type { Request, Response } from "express";
import express from "express";
import mimeTypes from "mime-types";
import morgan from "morgan";
import type { RollupOutput } from "rollup";
import signalExit from "signal-exit";

import { BuildMode, BuildTarget } from "./build";
import { watch, generate } from "./compiler";
import type { RemixConfig } from "./config";

type ReqResPair = { req: Request; res: Response };

export async function startAssetServer(
  config: RemixConfig,
  {
    onListen,
    onReady,
    onRebuild
  }: {
    onListen?: () => void;
    onReady?: () => void;
    onRebuild?: () => void;
  } = {}
) {
  let requestHandler = createRequestHandler(config, {
    onReady,
    onRebuild
  });

  let server = http.createServer(requestHandler);

  server.listen(config.devServerPort, onListen);

  signalExit(() => {
    server.close();
  });
}

function createRequestHandler(
  config: RemixConfig,
  {
    onReady,
    onRebuild
  }: {
    onReady?: () => void;
    onRebuild?: () => void;
  }
) {
  let output: RollupOutput["output"] | null = null;
  let unwatch = watch(config, {
    mode: BuildMode.Development,
    target: BuildTarget.Browser,
    onBuildStart() {
      if (output && onRebuild) onRebuild();
      output = null;
    },
    async onBuildEnd(build) {
      let result = await generate(build);
      output = result.output;
      if (onReady) onReady();
      flushPendingQueue();
    },
    onError(error) {
      console.error(error);
    }
  });

  signalExit(unwatch);

  let pendingQueue: ReqResPair[] = [];

  function flushPendingQueue() {
    while (pendingQueue.length > 0) {
      let { req, res } = pendingQueue.shift() as ReqResPair;
      handleRequest(req, res);
    }
  }

  function handleRequest(req: Request, res: Response) {
    if (!output) {
      console.log(`Waiting for the build to finish...`);
      pendingQueue.push({ req, res });
      return;
    }

    serveBuildOutput(req, res, output);
  }

  let app = express();

  app.disable("x-powered-by");

  app.use(morgan("dev"));
  app.use(cors());

  app.get("*", handleRequest);

  return app;
}

function serveBuildOutput(
  req: Request,
  res: Response,
  output: RollupOutput["output"]
) {
  let chunkOrAsset = output.find(item => req.url === getFileUrl(item.fileName));

  if (!chunkOrAsset) {
    res.status(404).send();
    return;
  }

  if (chunkOrAsset.type === "chunk") {
    res
      .set({
        "Content-Type": "text/javascript"
      })
      .send(chunkOrAsset.code);
  } else if (chunkOrAsset.type === "asset") {
    res
      .set({
        "Content-Type": mimeTypes.lookup(chunkOrAsset.fileName)
      })
      .send(chunkOrAsset.source);
  }
}

function getFileUrl(fileName: string) {
  return "/" + fileName.split(path.win32.sep).join("/");
}
