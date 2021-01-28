const express = require("express");
const morgan = require("morgan");
const { createRequestHandler } = require("@remix-run/express");

const port = process.env.PORT || 3000;

let app = express();

app.use(express.static("public"));

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

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
