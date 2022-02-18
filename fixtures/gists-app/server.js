const express = require("express");
const morgan = require("morgan");
const compression = require("compression");
const { createRequestHandler } = require("@remix-run/express");

const port = process.env.PORT || 3000;

if (process.env.NODE_ENV === "test") {
  class MockConsole {
    assert() {}
    clear() {}
    count() {}
    countReset() {}
    debug() {}
    dir() {}
    dirxml() {}
    error() {}
    group() {}
    groupCollapsed() {}
    groupEnd() {}
    info() {}
    log() {}
    table() {}
    time() {}
    timeEnd() {}
    timeLog() {}
    timeStamp() {}
    trace() {}
    warn() {}
  }
  global.console = new MockConsole();
}

let app = express();

app.use(compression());

app.use(
  express.static("public", {
    // maxAge: process.env.NODE_ENV === "production" ? "1y" : undefined
    maxAge: "1y"
  })
);

app.get("/fails.css", (req, res) => {
  res.status(500).send("Boom! No CSS here!");
});

// server-side redirect
app.get("/user-gists/:username", (req, res) => {
  res.redirect(301, `/gists/${req.params.username}`);
});

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.all(
  "*",
  createRequestHandler({
    build: require("@remix-run/dev/server-build"),
    getLoadContext() {
      return { userId: 4 };
    }
  })
);

app.listen(port, () => {
  console.log(`Gists app running on port ${port}`);
});
