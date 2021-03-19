import signalExit from "signal-exit";

import { BuildMode, isBuildMode, BuildTarget } from "../build";
import * as compiler from "../compiler";
import * as compiler2 from "../compiler2";
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

export async function build2(remixRoot: string, mode?: string) {
  let buildMode = isBuildMode(mode) ? mode : BuildMode.Production;

  console.log(`Building Remix app in ${buildMode} mode...`);

  let start = Date.now();

  let config = await readConfig(remixRoot);
  await compiler2.build(config, { mode: buildMode });

  console.log(`Built in ${Date.now() - start}ms`);
}

export async function watch2(remixRoot: string, mode?: string) {
  let buildMode = isBuildMode(mode) ? mode : BuildMode.Development;

  console.log(`Watching Remix app in ${buildMode} mode...`);

  let start = Date.now();
  let config = await readConfig(remixRoot);

  let unwatch = await compiler2.watch(config, {
    mode: buildMode,
    onRebuild({ ms }) {
      console.log(`Rebuilt in ${ms}ms`);
    }
  });

  console.log(`Built in ${Date.now() - start}ms`);

  signalExit(unwatch);
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
