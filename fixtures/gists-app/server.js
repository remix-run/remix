const path = require("path");
const express = require("express");
const morgan = require("morgan");
const compression = require("compression");
const { createRequestHandler } = require("@remix-run/express");

const port = process.env.PORT || 3000;
const MODE = process.env.NODE_ENV;
const BUILD_DIR = path.join(process.cwd(), "build");

let app = express();

if (MODE === "development") {
  app.use(remixWatch());
}

app.use(compression());

app.use(
  express.static("public", {
    // maxAge: process.env.NODE_ENV === "production" ? "1y" : undefined
    maxAge: "1y"
  })
);

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/fails.css", (req, res) => {
  res.status(500).send("Boom! No CSS here!");
});

// server-side redirect
app.get("/user-gists/:username", (req, res) => {
  res.redirect(301, `/gists/${req.params.username}`);
});

app.all(
  "*",
  MODE !== "development"
    ? createRequestHandler({ build: require("./build") })
    : (req, res, next) => {
        let build = require("./build");
        return createRequestHandler({ build, mode: MODE })(req, res, next);
      }
);

app.listen(port, () => {
  console.log(`Gists app running on port ${port}`);
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
