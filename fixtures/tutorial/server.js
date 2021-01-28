const express = require("express");
const morgan = require("morgan");
const { createRequestHandler } = require("@remix-run/express");

let app = express();

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use(express.static("public"));

app.all(
  "*",
  createRequestHandler({
    getLoadContext() {
      // Whatever you return here will be passed as `context` to your loaders.
    }
  })
);

let port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Express server started on http://localhost:${port}`);
});
