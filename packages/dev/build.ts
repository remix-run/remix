export enum BuildMode {
  Development = "development",
  Production = "production"
}

export function isBuildMode(mode: any): mode is BuildMode {
  return mode === BuildMode.Development || mode === BuildMode.Production;
}

export enum BuildTarget {
  Browser = "browser",
  Server = "server"
}

export function isBuildTarget(target: any): target is BuildTarget {
  return target === BuildTarget.Browser || target === BuildTarget.Server;
}
