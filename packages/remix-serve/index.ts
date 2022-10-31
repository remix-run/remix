import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";

export function createApp(
  buildPath: string,
  opts: {
    mode?: string;
    basename?: string;
    publicPath?: string;
    assetsBuildDirectory?: string;
  } = {}
): express.Express {
  let {
    mode = "production",
    basename = "",
    publicPath = "/build/",
    assetsBuildDirectory = "public/build/",
  } = opts;

  let app = express();
  let router: express.Router = app;

  app.disable("x-powered-by");

  if (basename) {
    // Create a custom basename router
    router = express.Router();
    app.use(basename, router);
    app.get("", (_, res) => {
      // redirect to basename
      res.redirect(basename);
    });
  }

  router.use(compression());

  router.use(
    publicPath,
    express.static(assetsBuildDirectory, { immutable: true, maxAge: "1y" })
  );

  router.use(express.static("public", { maxAge: "1h" }));

  router.use(morgan("tiny"));
  router.all(
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
