import getPort, { makeRange } from "get-port";
import os from "os";
import path from "node:path";
import prettyMs from "pretty-ms";
import fetch from "node-fetch";

import { type AssetsManifest } from "../assets-manifest";
import * as Compiler from "../compiler";
import { type RemixConfig } from "../config";
import { loadEnv } from "../env";
import * as Socket from "./utils/socket";

let relativePath = (file: string) => path.relative(process.cwd(), file);

let getHost = () =>
  process.env.HOST ??
  Object.values(os.networkInterfaces())
    .flat()
    .find((ip) => String(ip?.family).includes("4") && !ip?.internal)?.address;

let findPort = async (portPreference?: number) =>
  getPort({
    port:
      // prettier-ignore
      portPreference ? Number(portPreference) :
        process.env.PORT ? Number(process.env.PORT) :
          makeRange(3001, 3100),
  });

let sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let fetchAssetsManifest = async (
  origin: string,
  remixRequestHandlerPath: string
): Promise<AssetsManifest | undefined> => {
  try {
    let url = origin + remixRequestHandlerPath + "/__REMIX_ASSETS_MANIFEST";
    let res = await fetch(url);
    let assetsManifest = (await res.json()) as AssetsManifest;
    return assetsManifest;
  } catch (error) {
    return undefined;
  }
};

let info = (message: string) => console.info(`💿 ${message}`);

export let serve = async (config: RemixConfig) => {
  await loadEnv(config.rootDirectory);

  let { v2_dev } = config.future;
  if (v2_dev === false) {
    throw Error(
      "`remix dev2` requires that you enable the `v2_dev` future flag"
    );
  }
  let {
    appServerPort,
    remixRequestHandlerPath,
    rebuildPollIntervalMs,
    rebuildTimeoutMs,
  } = v2_dev;

  let host = getHost();
  let appServerOrigin = `http://${host ?? "localhost"}:${appServerPort}`;
  // TODO pass in an AbortController signal into waitForProxyServer
  let waitForProxyServer = async (buildHash: string) => {
    let elapsedMs = 0;
    while (elapsedMs < rebuildTimeoutMs) {
      // if canceled, move one
      let assetsManifest = await fetchAssetsManifest(
        appServerOrigin,
        remixRequestHandlerPath
      );
      if (assetsManifest?.version === buildHash) return;

      await sleep(rebuildPollIntervalMs);
      elapsedMs += rebuildPollIntervalMs;
    }
    throw Error(
      `Timeout: waited ${rebuildTimeoutMs}ms and app server running at ${appServerOrigin} did not respond with up-to-date build hash ${buildHash}`
    );
  };

  // watch and live reload on rebuilds
  let port = await findPort();
  let socket = Socket.serve({ port });
  let dispose = await Compiler.watch(config, {
    mode: "development",
    liveReloadPort: port,
    onInitialBuild: (durationMs) => info(`Built in ${prettyMs(durationMs)}`),
    onRebuildStart: () => socket.log("Rebuilding..."),
    onRebuildFinish: async (durationMs, assetsManifest) => {
      if (!assetsManifest) return;
      socket.log(`Rebuilt in ${prettyMs(durationMs)}`);

      info(`Waiting for ${appServerOrigin}...`);
      let start = Date.now();
      await waitForProxyServer(assetsManifest.version);
      info(`${appServerOrigin} ready in ${prettyMs(Date.now() - start)}`);

      socket.reload();
    },
    onFileCreated: (file) => socket.log(`File created: ${relativePath(file)}`),
    onFileChanged: (file) => socket.log(`File changed: ${relativePath(file)}`),
    onFileDeleted: (file) => socket.log(`File deleted: ${relativePath(file)}`),
  });

  // TODO exit hook: clean up assetsBuildDirectory and serverBuildPath?

  return async () => {
    await dispose();
    socket.close();
  };
};
