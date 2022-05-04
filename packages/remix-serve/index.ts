import path from "path";
import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";
import { readConfig } from "@remix-run/config";

export async function createApp(buildPath: string, mode = "production") {
  let app = express();

  app.disable("x-powered-by");

  app.use(compression());

  let publicPath;
  let assetsBuildDirectory;

  try {
    let cwd = process.cwd();
    let config = await readConfig(cwd);
    publicPath = config.publicPath;
    assetsBuildDirectory = path.relative(cwd, config.assetsBuildDirectory);
  } catch (error: unknown) {
    console.error("Could not read config", error);
    publicPath = "/build/";
    assetsBuildDirectory = "public/build";
  }

  app.use(
    publicPath,
    express.static(assetsBuildDirectory, { immutable: true, maxAge: "1y" })
  );

  app.use(express.static("public", { maxAge: "1h" }));

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
