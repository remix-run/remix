global.fetch = require("node-fetch");
const express = require("express");
const { createRequestHandler } = require("@remix-run/express");

const app = express();
app.use(express.static("public"));

// serverside redirect
app.get("/user-gists/:username", (req, res) => {
  res.redirect(301, `/gists/${req.params.username}`);
});

app.get(
  "*",
  createRequestHandler({
    getLoadContext: (req, res) => ({ userId: 4 })
  })
);

module.exports = app;
