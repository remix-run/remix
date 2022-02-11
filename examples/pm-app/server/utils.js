const path = require("path");
const { createRequestHandler } = require("@remix-run/express");

function purgeAppRequireCache() {
  const cwd = process.cwd();
  for (const key in require.cache) {
    if (key.startsWith(path.join(cwd, "server/build"))) {
      delete require.cache[key];
    }
  }
}

/**
 * @returns {ReturnType<typeof createRequestHandler>}
 */
function devHandler() {
  return (req, res, next) => {
    purgeAppRequireCache();
    return createRequestHandler({
      // @ts-ignore
      build: require("./build")
    })(req, res, next);
  };
}

/**
 * @returns {ReturnType<typeof createRequestHandler>}
 */
function prodHandler() {
  return createRequestHandler({
    // @ts-ignore
    build: require("./build")
  });
}

exports.devHandler = devHandler;
exports.prodHandler = prodHandler;
