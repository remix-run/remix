const path = require("path");
const express = require("express");
const compression = require("compression");
const morgan = require("morgan");
const { createRequestHandler } = require("@remix-run/express");

const MODE = process.env.NODE_ENV;
const BUILD_DIR = path.join(process.cwd(), "server/build");

let app = express();
app.use(compression());
app.use(morgan("tiny"));

// You may want to be more aggressive with this caching
app.use(express.static("public", { maxAge: "1h" }));

// Remix fingerprints its assets so we can cache forever
app.use(express.static("public/build", { immutable: true, maxAge: "1y" }));

// Middleware to build your Remix application in watch mode
if (MODE !== "production") {
  app.use(remixWatch());
}

// In production we just create the request handler, in dev we
// require it every request in-case there is a fresh build. We
// purge the require cache below in the remixWatch middleware.
app.all(
  "*",
  MODE === "production"
    ? createRequestHandler({ build: require("./build") })
    : (req, res, next) => {
        let build = require("./build");
        return createRequestHandler({ build, mode: MODE })(req, res, next);
      }
);

let port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});

////////////////////////////////////////////////////////////////////////////////
function remixWatch() {
  // do an initial build of your app and then start the remix watch server
  let remixCommands = require("@remix-run/dev/cli/commands");

  let doBuildAndStartWatchPromise = remixCommands
    .build(__dirname, process.env.NODE_ENV)
    .then(() => {
      remixCommands.watch(__dirname, process.env.NODE_ENV, undefined, () => {
        purgeRequireCache();
      });
    });

  return async (_, __, next) => {
    await doBuildAndStartWatchPromise;
    next();
  };
}

function purgeRequireCache() {
  // purge require cache on requests for "server side HMR" this won't let
  // you have in-memory objects between requests in development,
  // alternatively you can set up nodemon/pm2-dev to restart the server on
  // file changes, we prefer the DX of this though, so we've included it
  // for you by default
  for (let key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      delete require.cache[key];
    }
  }
}
