import { readConfig } from "./config";
import { build, BuildTarget } from "./compiler";
import { startDevServer } from "./devServer";

async function buildCommand(remixRoot: string) {
  console.log("Building Remix...");

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

export { buildCommand as build };

export async function run(remixRoot: string) {
  let config = await readConfig(remixRoot);

  startDevServer(config, {
    onListen() {
      console.log(
        `Remix dev server running on port ${config.devServerPort}...`
      );
    },
    onReady() {
      console.log(`Remix dev server ready for requests!`);
    },
    onRebuild() {
      console.log(`Restarting the build...`);
    }
  });
}
