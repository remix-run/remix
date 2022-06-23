import path from "path";
import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";

export function createApp(
  buildPath = "/build",
  mode = "production",
  {
    assetsBuildDirectory = "public/build",
    publicPath = path.dirname(assetsBuildDirectory),
    browserAssetsPath = "/build",
  }: {
    assetsBuildDirectory?: string;
    publicPath?: string;
    browserAssetsPath?: string;
  }
) {
  let app = express();

  app.disable("x-powered-by");

  app.use(compression());

  app.use(
    browserAssetsPath,
    express.static(assetsBuildDirectory, { immutable: true, maxAge: "1y" })
  );

  app.use(express.static(publicPath, { maxAge: "1h" }));

  app.use(morgan("tiny"));
  app.all(
    "*",
    mode === "production"
      ? createRequestHandler({ build: require(buildPath), mode })
      : (req, res, next) => {
          // require cache is purged in @remix-run/dev where the file watcher is
          let build = require(buildPath);
          return createRequestHandler({ build, mode })(req, res, next);
        }
  );

  return app;
}
