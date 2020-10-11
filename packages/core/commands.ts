import { readConfig } from "./config";
import { BuildMode, BuildTarget, build, write } from "./compiler";
import { startAssetServer } from "./assetServer";

/**
 * Runs the build for a Remix app.
 */
async function buildCommand(
  remixRoot: string,
  mode: BuildMode = BuildMode.Production
) {
  console.log("Building Remix app...");

  let config = await readConfig(remixRoot);

  let [serverBuild, browserBuild] = await Promise.all([
    build(config, { mode, target: BuildTarget.Server }),
    build(config, { mode, target: BuildTarget.Browser })
  ]);

  await write(serverBuild, config);
  await write(browserBuild, config);

  console.log("done!");
}

export { buildCommand as build };

/**
 * Runs the dev (asset) server for a Remix app.
 */
export async function run(remixRoot: string) {
  let config = await readConfig(remixRoot);

  startAssetServer(config, {
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
