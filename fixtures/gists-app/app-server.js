global.fetch = require("node-fetch");

const express = require("express");
const morgan = require("morgan");
const { createRequestHandler } = require("@remix-run/express");

const app = express();

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(express.static("public"));

// serverside redirect
app.get("/user-gists/:username", (req, res) => {
  res.redirect(301, `/gists/${req.params.username}`);
});

app.get(
  "*",
  createRequestHandler({
    getLoadContext() {
      return { userId: 4 };
    }
  })
);

module.exports = app;
