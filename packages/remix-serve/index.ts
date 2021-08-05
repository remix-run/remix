import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";

export function createApp({
  buildDir,
  mode = process.env.NODE_ENV,
  serverTiming
}: {
  buildDir: string;
  mode?: string;
  serverTiming?: boolean;
}) {
  if (mode === undefined) {
    mode = "production";
  }

  let app = express();

  app.use(compression());
  app.use(morgan("tiny"));
  app.use(express.static("public", { immutable: true, maxAge: "1y" }));

  app.all(
    "*",
    mode === "production"
      ? createRequestHandler({ build: require(buildDir), mode, serverTiming })
      : (req, res, next) => {
          // require cache is purged in @remix-run/dev where the file watcher is
          let handleRequest = createRequestHandler({
            build: require(buildDir),
            mode,
            serverTiming
          });
          return handleRequest(req, res, next);
        }
  );

  return app;
}
