import express from "express";
import type { Express } from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";
import type { RemixConfig } from "@remix-run/config";

export function createApp(
  serverBuildPathOrConfig: string | RemixConfig,
  mode = "production"
): Express {
  let serverBuildPath: string;
  let assetsBuildDirectory: string;
  let publicPath: string;
  if (typeof serverBuildPathOrConfig === "string") {
    // TODO: Deprecate using a string as 1st argument. Keep this behavior for
    // now to avoid breaking changes.
    serverBuildPath = serverBuildPathOrConfig;
    assetsBuildDirectory = "public/build";
    publicPath = "/build/";
  } else {
    serverBuildPath = serverBuildPathOrConfig.serverBuildPath;
    assetsBuildDirectory = serverBuildPathOrConfig.assetsBuildDirectory;
    publicPath = serverBuildPathOrConfig.publicPath;
  }

  let app = express();

  app.disable("x-powered-by");

  app.use(compression());

  app.use(
    publicPath,
    express.static(assetsBuildDirectory, { immutable: true, maxAge: "1y" })
  );

  app.use(express.static("public", { maxAge: "1h" }));

  app.use(morgan("tiny"));

  app.all(
    "*",
    mode === "production"
      ? createRequestHandler({ build: require(serverBuildPath), mode })
      : (req, res, next) => {
          // require cache is purged in @remix-run/dev where the file watcher is
          let build = require(serverBuildPath);
          return createRequestHandler({ build, mode })(req, res, next);
        }
  );

  return app;
}
