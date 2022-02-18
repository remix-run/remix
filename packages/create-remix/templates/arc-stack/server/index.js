const { createRequestHandler } = require("@remix-run/architect");
exports.handler = createRequestHandler({
  build: require("./build")
});
