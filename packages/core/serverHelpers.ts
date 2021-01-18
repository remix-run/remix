import type { AssetManifest } from "./buildManifest";
import { loadAssetManifest, loadServerManifest } from "./buildManifest";
import type { ServerEntryModule, RouteModules } from "./buildModules";
import { loadServerEntryModule, loadRouteModule } from "./buildModules";
import type { RemixConfig } from "./config";

export interface ServerBuild {
  assetManifest: AssetManifest;
  serverEntryModule: ServerEntryModule;
  routeModules: RouteModules;
}

export async function loadServerBuild(
  config: RemixConfig
): Promise<ServerBuild> {
  let buildDir = config.serverBuildDirectory;
  let routeIds = Object.keys(config.routeManifest);
  let manifest = loadServerManifest(buildDir);

  return {
    assetManifest: loadAssetManifest(buildDir),
    serverEntryModule: loadServerEntryModule(buildDir, manifest),
    routeModules: routeIds.reduce((memo, routeId) => {
      memo[routeId] = loadRouteModule(buildDir, manifest, routeId);
      return memo;
    }, {} as RouteModules)
  };
}
