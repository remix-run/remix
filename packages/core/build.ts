import type { RollupBuild } from "rollup";

import type { RouteModuleFiles } from "./rollup/routeModules";

export enum BuildMode {
  Development = "development",
  Production = "production"
}

export enum BuildTarget {
  Browser = "browser",
  Server = "server"
}

export interface BuildOptions {
  mode: BuildMode;
  target: BuildTarget;
  manifestDir?: string;
  routeModuleFiles?: RouteModuleFiles;
}

export interface RemixBuild extends RollupBuild {
  options: BuildOptions;
}

export function createBuild(
  rollupBuild: RollupBuild,
  options: BuildOptions
): RemixBuild {
  let build = (rollupBuild as unknown) as RemixBuild;
  build.options = options;
  return build;
}
