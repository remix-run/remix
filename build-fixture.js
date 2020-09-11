const path = require("path");
const { build } = require("./build/node_modules/@remix-run/core");

let remixRoot = path.resolve(__dirname, "fixtures/gists-app");

async function run() {
  console.log("building gists-app fixture...");

  let bundle = await build({ remixRoot });

  await bundle.write({
    dir: path.join(remixRoot, "build"),
    format: "cjs",
    exports: "named"
  });

  console.log("done!");
}

run();
