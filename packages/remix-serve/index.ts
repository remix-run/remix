import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";

export async function createApp(buildPath: string, mode = "production") {
  let app = express();

  app.disable("x-powered-by");

  app.use(compression());
  app.use(express.static("public", { immutable: true, maxAge: "1y" }));

  app.use(morgan("tiny"));
  app.all(
    "*",
    mode === "production"
      ? createRequestHandler({ build: await import(buildPath), mode })
      : async (req, res, next) => {
          try {
            // require cache is purged in @remix-run/dev where the file watcher is
            let build = await import(buildPath);
            return createRequestHandler({ build, mode })(req, res, next);
          } catch (error) {
            next(error);
          }
        }
  );

  return app;
}
