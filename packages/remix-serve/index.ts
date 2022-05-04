import path from "path";
import express from "express";
import type { Express } from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";
import type { RemixConfig } from "@remix-run/config";

export function createApp(buildPathOrConfig: RemixConfig): Express;

export function createApp(buildPathOrConfig: string): Express;

export function createApp(
  buildPathOrConfig: string | RemixConfig,
  mode = "production"
): Express {
  let app = express();

  app.disable("x-powered-by");

  app.use(compression());

  // this is the old behavior, but we're keeping it around to prevent breaking changes
  if (typeof buildPathOrConfig === "string") {
    app.use(
      "/build/",
      express.static("public/build", { immutable: true, maxAge: "1y" })
    );

    app.use(express.static("public", { maxAge: "1h" }));

    app.use(morgan("tiny"));
    app.all(
      "*",
      mode === "production"
        ? createRequestHandler({ build: require(buildPathOrConfig), mode })
        : (req, res, next) => {
            // require cache is purged in @remix-run/dev where the file watcher is
            let build = require(buildPathOrConfig);
            return createRequestHandler({ build, mode })(req, res, next);
          }
    );
  } else {
    app.use(
      buildPathOrConfig.publicPath,
      express.static(
        path.relative(process.cwd(), buildPathOrConfig.assetsBuildDirectory),
        { immutable: true, maxAge: "1y" }
      )
    );

    app.use(morgan("tiny"));
    app.all(
      "*",
      mode === "production"
        ? createRequestHandler({
            build: require(buildPathOrConfig.serverBuildPath),
            mode,
          })
        : (req, res, next) => {
            // require cache is purged in @remix-run/dev where the file watcher is
            let build = require(buildPathOrConfig.serverBuildPath);
            return createRequestHandler({ build, mode })(req, res, next);
          }
    );
  }

  return app;
}
