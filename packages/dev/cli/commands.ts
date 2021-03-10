import { BuildMode, isBuildMode, BuildTarget } from "../build";
import * as compiler from "../compiler";
import { readConfig } from "../config";
import { startDevServer } from "../server";

/**
 * Runs the build for a Remix app.
 */
export async function build(remixRoot: string, mode?: string) {
  let buildMode = isBuildMode(mode) ? mode : BuildMode.Production;

  console.log(`Building Remix app for ${buildMode}...`);

  let config = await readConfig(remixRoot);

  await Promise.all([
    compiler.write(
      await compiler.build(config, {
        mode: buildMode,
        target: BuildTarget.Server
      }),
      config.serverBuildDirectory
    ),
    compiler.write(
      await compiler.build(config, {
        mode: buildMode,
        target: BuildTarget.Browser
      }),
      config.assetsBuildDirectory
    )
  ]);

  console.log("done!");
}

/**
 * Runs the dev server for a Remix app.
 */
export async function run(remixRoot: string) {
  let config = await readConfig(remixRoot);

  startDevServer(config, {
    onListen() {
      console.log(
        `Remix dev server running on port ${config.devServerPort}...`
      );
    }
  });
}
