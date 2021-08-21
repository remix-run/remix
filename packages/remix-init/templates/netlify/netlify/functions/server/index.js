const { createRequestHandler } = require("@remix-run/netlify");

exports.handler = createRequestHandler({
  build: require("./build")
});
