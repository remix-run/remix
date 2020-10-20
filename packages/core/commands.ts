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
  console.log(`Building Remix app for ${mode}...`);

  let config = await readConfig(remixRoot);

  await Promise.all([
    write(
      await build(config, {
        mode,
        target: BuildTarget.Server,
        manifestDir: config.serverBuildDirectory
      }),
      config.serverBuildDirectory
    ),
    write(
      await build(config, {
        mode,
        target: BuildTarget.Browser,
        manifestDir: config.serverBuildDirectory
      }),
      config.browserBuildDirectory
    )
  ]);

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
        `Remix asset server running on port ${config.devServerPort}...`
      );
    },
    onReady() {
      console.log(`Remix asset server ready for requests!`);
    },
    onRebuild() {
      console.log(`Restarting the build...`);
    }
  });
}
