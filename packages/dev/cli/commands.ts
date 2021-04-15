import * as path from "path";
import signalExit from "signal-exit";
import prettyMs from "pretty-ms";

import { BuildMode, isBuildMode } from "../build";
import * as compiler2 from "../compiler2";
import { readConfig, RemixConfig } from "../config";

export async function run(remixRoot: string) {
  let config = await readConfig(remixRoot);
  let getAppServer = require("@remix-run/serve");
  let port = process.env.PORT || 3000;

  getAppServer(config.serverBuildDirectory).listen(port, () => {
    console.log(`Remix App Server started at http://localhost:${port}`);
  });

  dev(config);
}

export async function build(
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

export async function dev(
  remixRootOrConfig: string | RemixConfig,
  modeArg?: string
): Promise<void> {
  let mode = isBuildMode(modeArg) ? modeArg : BuildMode.Development;

  console.log(`Watching Remix app in ${mode} mode...`);

  let start = Date.now();
  let config =
    typeof remixRootOrConfig === "object"
      ? remixRootOrConfig
      : await readConfig(remixRootOrConfig);
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
