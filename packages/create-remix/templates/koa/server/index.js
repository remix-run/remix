const path = require("path");
const Koa = require("koa");
const compress = require("koa-compress");
const morgan = require("koa-morgan");
const static = require("koa-static");
const { createRequestHandler } = require("@remix-run/koa");

const MODE = process.env.NODE_ENV;
const BUILD_DIR = path.join(process.cwd(), "server/build");

const app = new Koa();
app.use(compress());

// You may want to be more aggressive with this caching
app.use(static("public", { maxage: 3600000 }));

// Remix fingerprints its assets so we can cache forever
app.use(
  static("public/build", {
    setHeaders: res => {
      res.set("Cache-Control", true);
    },
    maxage: 31557600000
  })
);

app.use(morgan("tiny"));
app.use(
  MODE === "production"
    ? createRequestHandler({ build: require("./build") })
    : (ctx, next) => {
        purgeRequireCache();
        const build = require("./build");
        return createRequestHandler({ build, mode: MODE })(ctx, next);
      }
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Koa server listening on port ${port}`);
});

////////////////////////////////////////////////////////////////////////////////
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
