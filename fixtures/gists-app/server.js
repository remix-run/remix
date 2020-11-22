const express = require("express");
const morgan = require("morgan");
const session = require("express-session");
const { createRequestHandler } = require("@remix-run/express");

const port = process.env.PORT || 3000;

let app = express();

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(express.static("public"));
app.use(session({ secret: "remix", resave: false, saveUninitialized: false }));

// server-side redirect
app.get("/user-gists/:username", (req, res) => {
  res.redirect(301, `/gists/${req.params.username}`);
});

app.all(
  "*",
  createRequestHandler({
    getLoadContext() {
      return { userId: 4 };
    }
  })
);

app.listen(port, () => {
  console.log(`Gists app running on port ${port}`);
});
