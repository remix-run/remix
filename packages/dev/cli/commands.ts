import * as path from "path";
import signalExit from "signal-exit";
import prettyMs from "pretty-ms";

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

///////////////////////////////////////////////////////////////////////////////

export async function build2(
  remixRoot: string,
  modeArg?: string
): Promise<void> {
  let mode = isBuildMode(modeArg) ? modeArg : BuildMode.Production;

  console.log(`Building Remix app in ${mode} mode...`);

  let start = Date.now();
  let config = await readConfig(remixRoot);
  await compiler2.build(config, { mode: mode });

  console.log(`Built in ${prettyMs(Date.now() - start)}`);
}

export async function watch2(
  remixRoot: string,
  modeArg?: string
): Promise<void> {
  let mode = isBuildMode(modeArg) ? modeArg : BuildMode.Development;

  console.log(`Watching Remix app in ${mode} mode...`);

  let start = Date.now();
  let config = await readConfig(remixRoot);
  signalExit(
    await compiler2.watch(config, {
      mode,
      onRebuildStart() {
        start = Date.now();
      },
      onRebuildFinish() {
        console.log(`Rebuilt in ${prettyMs(Date.now() - start)}`);
      },
      onFileCreated(file) {
        console.log(`File created: ${path.relative(process.cwd(), file)}`);
      },
      onFileChanged(file) {
        console.log(`File changed: ${path.relative(process.cwd(), file)}`);
      },
      onFileDeleted(file) {
        console.log(`File deleted: ${path.relative(process.cwd(), file)}`);
      }
    })
  );

  console.log(`Built in ${prettyMs(Date.now() - start)}`);
}

export function run2(remixRoot: string): Promise<void> {
  return watch2(remixRoot);
}
