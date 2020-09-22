import type { Request, Response } from "express";
import express from "express";
import type { RollupOutput } from "rollup";
import mimeTypes from "mime-types";
import morgan from "morgan";
import onExit from "signal-exit";
import cors from "cors";

import { BuildMode, BuildTarget, watch } from "./compiler";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";

type ReqResPair = { req: Request; res: Response };

export async function run(
  remixRoot: string,
  {
    onListen,
    onRebuild,
    onReady
  }: {
    onListen?: (port: number) => void;
    onRebuild?: () => void;
    onReady?: () => void;
  }
) {
  let config = await readConfig(remixRoot);

  let output: RollupOutput | null = null;
  let unwatch = watch(config, {
    mode: BuildMode.Development,
    target: BuildTarget.Browser,
    onBuildStart() {
      output = null;

      if (onRebuild) onRebuild();
    },
    async onBuildEnd(build) {
      output = await build.generate({
        format: "esm"
      });

      // console.log(
      //   output.output.map(chunkOrAsset => getOutputUrl(chunkOrAsset.fileName))
      // );

      if (onReady) onReady();

      flushPendingQueue();
    },
    onError(error) {
      console.error(error);
    }
  });

  onExit(unwatch);

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

    let chunkOrAsset = getOutput(output, req.url);

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

  let app = express();

  app.disable("x-powered-by");

  app.use(morgan("dev"));
  app.use(cors());

  app.get("*", handleRequest);

  app.listen(config.devServerPort, () => {
    if (onListen) onListen(config.devServerPort);
  });
}

function getOutput(output: RollupOutput, url: string) {
  return output.output.find(item => url === getOutputUrl(item.fileName));
}

function getOutputUrl(fileName: string) {
  return "/" + fileName.split("\\").join("/");
}
