import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";

export function createApp(buildPath: string, mode = "production") {
  let app = express();

  app.disable("x-powered-by");

  app.use(
    compression({
      filter(req) {
        // No compression for html document requests to allow for streaming
        if (
          req.headers["accept"] &&
          req.headers["accept"].indexOf("text/html") !== -1
        ) {
          return false;
        }

        // No compression for _data requests to allow for streaming
        if (req.query._data) {
          return false;
        }

        return true;
      },
    })
  );

  app.use(
    "/build",
    express.static("public/build", { immutable: true, maxAge: "1y" })
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
