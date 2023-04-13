import path from "path";
import express from "express";
import compression from "compression";
import morgan from "morgan";
import { createRequestHandler } from "@remix-run/express";

const app = express();

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// Remix fingerprints its assets so we can cache forever.
app.use(
  "/build",
  express.static("public/build", { immutable: true, maxAge: "1y" })
);

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("public", { maxAge: "1h" }));

app.use(morgan("tiny"));

const BUILD_DIR = path.join(process.cwd(), "build");
const MODE = process.env.NODE_ENV;
app.all(
  "*",
  MODE === "production"
    ? createRequestHandler({ build: require(BUILD_DIR), mode: MODE })
    : (...args) => {
        purgeRequireCache();

        return createRequestHandler({
          build: require(BUILD_DIR),
          mode: MODE,
        })(...args);
      }
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Express server listening on port ${port}`);
});

function purgeRequireCache() {
  // purge require cache on requests for "server side HMR" this won't let
  // you have in-memory objects between requests in development,
  // alternatively you can set up nodemon/pm2-dev to restart the server on
  // file changes, we prefer the DX of this though, so we've included it
  // for you by default
  for (const key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      delete require.cache[key];
    }
  }
}
