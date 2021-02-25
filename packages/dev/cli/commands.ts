import { BuildMode, BuildTarget } from "@remix-run/core";

import { readConfig } from "../config";
import { build as compilerBuild, write } from "../compiler";
import { startDevServer } from "../server";

/**
 * Runs the build for a Remix app.
 */
export async function build(
  remixRoot: string,
  buildMode: string = BuildMode.Production
) {
  if (
    buildMode !== BuildMode.Development &&
    buildMode !== BuildMode.Production
  ) {
    buildMode = BuildMode.Production;
  }

  console.log(`Building Remix app for ${buildMode}...`);

  let config = await readConfig(remixRoot);

  await Promise.all([
    write(
      await compilerBuild(config, {
        mode: buildMode,
        target: BuildTarget.Server
      }),
      config.serverBuildDirectory
    ),
    write(
      await compilerBuild(config, {
        mode: buildMode,
        target: BuildTarget.Browser
      }),
      config.browserBuildDirectory
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
