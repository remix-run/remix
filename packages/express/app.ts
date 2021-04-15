import path from "path";
import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "./index";

////////////////////////////////////////////////////////////////////////////////
let cwd = process.cwd();
let config = require(path.resolve(cwd, "remix.config.js"));
let buildPath = path.join(cwd, config.serverBuildDirectory);

let app = express();

app.use(compression());

app.use(
  express.static("public", {
    immutable: true,
    maxAge: "1y"
  })
);

app.use(morgan("combined"));

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

export default app;

////////////////////////////////////////////////////////////////////////////////
function purgeAppRequireCache() {
  for (let key in require.cache) {
    if (key.startsWith(buildPath)) {
      delete require.cache[key];
    }
  }
}
