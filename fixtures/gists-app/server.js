const express = require("express");
const morgan = require("morgan");
const compression = require("compression");
const { createRequestHandler } = require("@remix-run/express");

const port = process.env.PORT || 3000;

let app = express();

app.use(compression());

app.use(
  express.static("public", {
    // maxAge: process.env.NODE_ENV === "production" ? "1y" : undefined
    maxAge: "1y"
  })
);

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/fails.css", (req, res) => {
  res.status(500).send("Boom! No CSS here!");
});

// server-side redirect
app.get("/user-gists/:username", (req, res) => {
  res.redirect(301, `/gists/${req.params.username}`);
});

app.all(
  "*",
  createRequestHandler({
    build: require("./build"),
    getLoadContext() {
      return { userId: 4 };
    }
  })
);

app.listen(port, () => {
  console.log(`Gists app running on port ${port}`);
});
