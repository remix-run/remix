const { createRequestHandler } = require("./handler");

module.exports = createRequestHandler({ build: require("./build") });
