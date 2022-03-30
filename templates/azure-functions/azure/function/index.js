const { createRequestHandler } = require("@remix-run/azure-functions");

module.exports = createRequestHandler({ build: require("./build") });
