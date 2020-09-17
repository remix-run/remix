const path = require("path");
const {
  build,
  readConfig,
  BuildTarget
} = require("./build/node_modules/@remix-run/core");

let remixRoot = path.resolve(__dirname, "fixtures/gists-app");

async function run() {
  console.log("building gists-app fixture...");

  let config = await readConfig(remixRoot);

  let [serverBuild, browserBuild] = await Promise.all([
    build(config, { target: BuildTarget.Server }),
    build(config, { target: BuildTarget.Browser })
  ]);

  await serverBuild.write({
    dir: config.serverBuildDirectory,
    format: "cjs",
    exports: "named"
  });

  await browserBuild.write({
    dir: config.browserBuildDirectory,
    format: "esm"
  });

  console.log("done!");
}

run();
