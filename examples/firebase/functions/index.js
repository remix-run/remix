const { onRequest } = require("firebase-functions/v2/https");
const { createRequestHandler } = require("remix-google-cloud-functions");

const remix = onRequest(
  createRequestHandler({
    build: require("../build"),
  })
);
module.exports = { remix };
