import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";

export function createApp(buildPath: string, mode = "production") {
  let app = express();

  app.use(compression());
  if (mode === "production") {
    // Remix fingerprints its assets so we can cache forever
    app.use(
      "/build",
      express.static("public/build", { immutable: true, maxAge: "1y" })
    );
    // Any other assets such as favicons.
    app.use(express.static("public", { maxAge: "1h" }));
  } else {
    // No caching needed
    app.use(express.static("public"));
  }

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
