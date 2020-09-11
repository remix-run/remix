const path = require("path");
const { build: runBuild } = require("./build/node_modules/@remix-run/core");

let remixRoot = path.resolve(__dirname, "fixtures/gists-app");

async function run() {
  console.log("building gists-app fixture...");

  let { remixConfig, build } = await runBuild({ remixRoot });

  await build.write({
    dir: remixConfig.serverBuildDirectory,
    format: "cjs",
    exports: "named"
  });

  console.log("done!");
}

run();
