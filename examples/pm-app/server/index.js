const express = require("express");
const { prodHandler, devHandler } = require("./utils");

const app = express();
const port = 3535;

main();

function main() {
  app.use(express.static("public", { immutable: true, maxAge: "1y" }));
  app.all(
    "*",
    process.env.NODE_ENV === "production" ? prodHandler() : devHandler()
  );

  app.listen(port, () => {
    console.log(`Express server started on http://localhost:${port}`);
  });
}
