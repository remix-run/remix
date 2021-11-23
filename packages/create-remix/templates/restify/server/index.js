const path = require("path");
const send = require("send");
const restify = require("restify");
const formatText = require("restify/lib/formatters/text");
const morgan = require("morgan");
const { createRequestHandler } = require("@remix-run/restify");

const MODE = process.env.NODE_ENV;
const BUILD_DIR = path.join(process.cwd(), "server/build");

let app = restify.createServer({
  formatters: {
    "application/json": formatText,
    "text/css": formatText,
    "text/html": formatText,
    "text/javascript": formatText
  }
});
app.use(morgan("tiny"));

const staticHandlers = [
  // You may want to be more aggressive with this caching
  buildStaticHandler("./public", { maxAge: "1h" }),
  // You may want to be more aggressive with this caching
  buildStaticHandler("./public/build", { immutable: true, maxAge: "1y" })
];

const requestHandler =
  MODE === "production"
    ? createRequestHandler({ build: require("./build") })
    : (req, res, next) => {
        purgeRequireCache();
        let build = require("./build");
        return createRequestHandler({ build, mode: MODE })(req, res, next);
      };

app.get("/*", [...staticHandlers, requestHandler]);
app.head("/*", requestHandler);
app.patch("/*", requestHandler);
app.put("/*", requestHandler);
app.post("/*", requestHandler);
app.del("/*", requestHandler);
app.opts("/*", requestHandler);

let port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Restify server listening on port ${port}`);
});

////////////////////////////////////////////////////////////////////////////////
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

// like the serveStatic / serveStaticFiles plugins, but falls through to the next handler.
// this way we it can match the same path space as remix.
function buildStaticHandler(dir, options = {}) {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const requestedFile = req.params["*"];
    const stream = send(req, requestedFile, {
      root: path.resolve(dir),
      ...options
    });
    stream.on("end", () => next(false));
    stream.on("error", () => next());
    stream.on("directory", () => next());
    return stream.pipe(res);
  };
}
