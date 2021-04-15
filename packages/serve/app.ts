import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";

////////////////////////////////////////////////////////////////////////////////
export default function getApp(buildPath: string) {
  let app = express();

  app.use(compression());

  app.use(
    express.static("public", {
      immutable: true,
      maxAge: "1y"
    })
  );

  app.use(morgan("tiny"));

  app.all(
    "*",
    process.env.NODE_ENV === "production"
      ? createRequestHandler({
          build: require(buildPath)
        })
      : (req, res, next) => {
          purgeAppRequireCache();
          return createRequestHandler({
            build: require(buildPath)
          })(req, res, next);
        }
  );

  function purgeAppRequireCache() {
    for (let key in require.cache) {
      if (key.startsWith(buildPath)) {
        delete require.cache[key];
      }
    }
  }

  return app;
}
