import path from "path";

import type { AssetManifest } from "./buildManifest";
import {
  AssetManifestFilename,
  loadAssetManifest,
  loadServerManifest
} from "./buildManifest";
import type {
  ServerEntryModule,
  GlobalDataModule,
  RouteModules
} from "./buildModules";
import {
  loadServerEntryModule,
  loadGlobalDataModule,
  loadRouteModule
} from "./buildModules";
import { writeDevServerBuild } from "./compiler";
import type { RemixConfig } from "./config";
import { ServerMode } from "./config";

export interface ServerBuild {
  serverEntryModule: ServerEntryModule;
  globalDataModule: GlobalDataModule | null;
  routeModules: RouteModules;
}

export async function loadServerBuild(
  config: RemixConfig,
  routeIds: string[] = []
): Promise<ServerBuild> {
  let buildDir: string;
  if (config.serverMode === ServerMode.Development) {
    buildDir = path.join(config.rootDirectory, ".build-cache");

    let routeModuleFiles = routeIds.reduce((memo, routeId) => {
      let route = config.routeManifest[routeId];
      if (route && route.moduleFile) {
        memo[route.id] = path.resolve(config.appDirectory, route.moduleFile);
      }
      return memo;
    }, {} as { [routeId: string]: string });

    await writeDevServerBuild(config, buildDir, routeModuleFiles);
  } else {
    buildDir = config.serverBuildDirectory;
  }

  let manifest = loadServerManifest(buildDir);

  return {
    serverEntryModule: loadServerEntryModule(buildDir, manifest),
    globalDataModule: loadGlobalDataModule(buildDir, manifest),
    routeModules: routeIds.reduce((routeModules, routeId) => {
      routeModules[routeId] = loadRouteModule(buildDir, manifest, routeId);
      return routeModules;
    }, {} as RouteModules)
  };
}

export async function loadServerAssetManifest(
  config: RemixConfig
): Promise<AssetManifest> {
  if (config.serverMode === ServerMode.Development) {
    let res = await fetch(config.publicPath + AssetManifestFilename);
    return res.json();
  }

  return loadAssetManifest(config.serverBuildDirectory);
}
