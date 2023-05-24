import exitHook from "exit-hook";
import fse from "fs-extra";
import path from "path";
import prettyMs from "pretty-ms";
import WebSocket from "ws";

import { watch } from "../compiler";
import type { RemixConfig } from "../config";
import { warnOnce } from "../warnOnce";

const relativePath = (file: string) => path.relative(process.cwd(), file);

let clean = (config: RemixConfig) => {
  try {
    fse.emptyDirSync(config.assetsBuildDirectory);
  } catch {
    // ignore failed clean up attempts
  }
};

export async function liveReload(config: RemixConfig) {
  clean(config);
  let wss = new WebSocket.Server({ port: config.devServerPort });
  function broadcast(event: { type: string } & Record<string, unknown>) {
    setTimeout(() => {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(event));
        }
      });
    }, config.devServerBroadcastDelay);
  }

  function log(message: string) {
    let _message = `💿 ${message}`;
    console.log(_message);
    broadcast({ type: "LOG", message: _message });
  }

  let hasBuilt = false;
  let dispose = await watch(
    {
      config,
      options: {
        mode: "development",
        sourcemap: true,
        metafile: config.metafile,
        onWarning: warnOnce,
      },
    },
    {
      onBuildStart() {
        clean(config);
        log((hasBuilt ? "Rebuilding" : "Building") + "...");
      },
      onBuildFinish(_, durationMs: number, manifest) {
        if (manifest === undefined) return;
        hasBuilt = true;
        log((hasBuilt ? "Rebuilt" : "Built") + ` in ${prettyMs(durationMs)}`);
        broadcast({ type: "RELOAD" });
      },
      onFileCreated(file) {
        log(`File created: ${relativePath(file)}`);
      },
      onFileChanged(file) {
        log(`File changed: ${relativePath(file)}`);
      },
      onFileDeleted(file) {
        log(`File deleted: ${relativePath(file)}`);
      },
    }
  );

  exitHook(() => clean(config));
  return async () => {
    wss.close();
    await dispose();
  };
}
