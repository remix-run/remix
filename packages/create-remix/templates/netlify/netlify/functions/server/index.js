const path = require("path");
const { createRequestHandler } = require("@remix-run/netlify");

const BUILD_DIR = path.join(process.cwd(), "netlify");

function purgeRequireCache() {
  // purge require cache on requests for "server side HMR" this won't let
  // you have in-memory objects between requests in development,
  // netlify typically does this for you, but we've found it to be hit or
  // miss and some times requires you to refresh the page after it auto reloads
  // or even have to restart your server
  for (let key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      delete require.cache[key];
    }
  }
}

exports.handler =
  process.env.NODE_ENV === "production"
    ? createRequestHandler({ build: require("./build") })
    : (event, context) => {
        purgeRequireCache();
        return createRequestHandler({ build: require("./build") })(
          event,
          context
        );
      };
