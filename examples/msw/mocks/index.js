const { rest } = require("msw");
const { setupServer } = require("msw/node");

const handlers = [
  rest.get("https://my-mock-api.com", (_, res, ctx) => {
    return res(ctx.status(200), ctx.json({ message: "from msw" }));
  }),
];

const server = setupServer(...handlers);
server.listen({ onUnhandledRequest: "warn" });
console.info("MSW initialised");

process.once("SIGINT", () => server.close());
process.once("SIGTERM", () => server.close());
