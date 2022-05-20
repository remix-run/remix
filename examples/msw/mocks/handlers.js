const { rest } = require("msw");

const handlers = [
  rest.get("https://my-mock-api.com", (_, res, ctx) => {
    return res(ctx.status(200), ctx.json({ message: "from msw" }));
  }),
];

module.exports = handlers;
