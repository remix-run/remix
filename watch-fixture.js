const path = require("path");
const { watch } = require("./build/node_modules/@remix-run/core");

let remixRoot = path.resolve(__dirname, "fixtures/gists-app");

async function run() {
  console.log("watching gists-app fixture...");

  let watcher = watch({
    remixRoot,
    async onBuild({ remixConfig, build }) {
      // console.log({ watchFiles: build.watchFiles });

      await build.write({
        dir: remixConfig.serverBuildDirectory,
        format: "cjs",
        exports: "named"
      });
    }
  });
}

run();
