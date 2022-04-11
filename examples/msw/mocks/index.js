const { setupServer } = require("msw/node");
const handlers = require("./handlers");

const server = setupServer(...handlers);
server.listen({ onUnhandledRequest: "warn" });
console.info("MSW initialised");
