import * as path from "path";

import { EsmHmrEngine } from "esm-hmr/src/server";
import signalExit from "signal-exit";
import prettyMs from "pretty-ms";

import type { createApp as createAppType } from "@remix-run/serve";

import { BuildMode, isBuildMode } from "../build";
import * as compiler from "../compiler";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

export async function build(
  remixRoot: string,
  modeArg?: string
): Promise<void> {
  let mode = isBuildMode(modeArg) ? modeArg : BuildMode.Production;

  console.log(`Building Remix app in ${mode} mode...`);

  let start = Date.now();
  let config = await readConfig(remixRoot);
  await compiler.build(config, { mode: mode });

  console.log(`Built in ${prettyMs(Date.now() - start)}`);
}

export async function watch(
  remixRootOrConfig: string | RemixConfig,
  modeArg?: string,
  onRebuildStart?: () => void,
  hrm?: EsmHmrEngine
): Promise<void> {
  let mode = isBuildMode(modeArg) ? modeArg : BuildMode.Development;
  console.log(`💿 Watching Remix app in ${mode} mode...`);

  let start = Date.now();
  let config =
    typeof remixRootOrConfig === "object"
      ? remixRootOrConfig
      : await readConfig(remixRootOrConfig);

  function broadcast(event: { type: string; [key: string]: any }) {
    (hrm?.broadcastMessage as any)("message", event);
  }

  function log(_message: string) {
    let message = `💿 ${_message}`;
    console.log(message);
    broadcast({ type: "LOG", message });
  }

  let filesChanged = { start, files: new Set<string>() };
  signalExit(
    await compiler.watch(config, {
      mode,
      onRebuildStart() {
        start = Date.now();
        filesChanged.start = start;
        onRebuildStart && onRebuildStart();
        log("Rebuilding...");
      },
      onRebuildFinish([browserBuild]) {
        log(`Rebuilt in ${prettyMs(Date.now() - start)}`);

        let processChangedFile = (file: string, extraProps?: any) => {
          let newFile = Object.entries(
            browserBuild?.metafile?.outputs || {}
          ).find(([outputFile, data]) => data.inputs[file]);

          if (newFile) {
            let mod = newFile[0].replace(/^public/, "");
            // console.log("newFile", newFile)
            broadcast({ ...extraProps, type: "update", id: file, mod });
            return true;
          }

          return false;
        };

        let foundSomethingToReload = false;
        if (filesChanged.files.size > 0) {
          for (let file of filesChanged.files) {
            let foundMatch = false;
            if (!file.match(/\.[jt]sx?$/)) {
              let inputsThatReferenceTheFile = Object.entries(
                browserBuild?.metafile?.inputs || {}
              ).filter(([_, input]) =>
                input.imports.some(item => item.path === file)
              );

              if (inputsThatReferenceTheFile.length > 0) {
                foundMatch = true;
                inputsThatReferenceTheFile.forEach(([file]) => {
                  foundSomethingToReload =
                    processChangedFile(file) || foundSomethingToReload;
                });
              }
              console.log("foundMatch", foundMatch);
              if (foundMatch) {
                console.log("foundSomethingToReload");
                console.log(Object.keys(browserBuild?.metafile?.inputs || {}));
                foundSomethingToReload =
                  processChangedFile(
                    "node_modules/@remix-run/react/browser/components.js",
                    {
                      manifest:
                        browserBuild?.metafile?.outputs?.__metafile
                          .entryPoint &&
                        "/" +
                          path.relative(
                            path.resolve(config.assetsBuildDirectory, ".."),
                            browserBuild.metafile.outputs.__metafile.entryPoint
                          )
                    }
                  ) || foundSomethingToReload;
                continue;
              }

              foundSomethingToReload =
                processChangedFile(file) || foundSomethingToReload;
            }
          }
        }

        if (!foundSomethingToReload) {
          broadcast({ type: "reload" });
        }

        filesChanged = { start, files: new Set() };
      },
      onFileCreated(file) {
        log(`File created: ${path.relative(process.cwd(), file)}`);
      },
      onFileChanged(file) {
        log(`File changed: ${path.relative(process.cwd(), file)}`);
        filesChanged.files.add(path.relative(config.rootDirectory, file));
      },
      onFileDeleted(file) {
        log(`File deleted: ${path.relative(process.cwd(), file)}`);
      }
    })
  );

  console.log(`💿 Built in ${prettyMs(Date.now() - start)}`);
}

export async function run(remixRoot: string, modeArg?: string) {
  // TODO: Warn about the need to install @remix-run/serve if it isn't there?
  let { createApp } = require("@remix-run/serve") as {
    createApp: typeof createAppType;
  };
  let express = require("express");

  let config = await readConfig(remixRoot);
  let mode = isBuildMode(modeArg) ? modeArg : BuildMode.Development;
  let port = process.env.PORT || 3000;

  let remixApp = createApp(config.serverBuildDirectory, mode);
  let app: typeof remixApp = express();

  let hmr = new EsmHmrEngine();

  app.use("/livereload", (req, res) => {
    hmr.connectClient(res);
  });

  app.use(remixApp);

  app.listen(port, () => {
    console.log(`🚀 Remix App Server started at http://localhost:${port}`);
  });

  watch(
    config,
    mode,
    () => {
      purgeAppRequireCache(config.serverBuildDirectory);
    },
    hmr
  );
}

function purgeAppRequireCache(buildPath: string) {
  for (let key in require.cache) {
    if (key.startsWith(buildPath)) {
      delete require.cache[key];
    }
  }
}
