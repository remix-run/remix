export enum BuildMode {
  Development = "development",
  Production = "production",
  Test = "test",
}

export function isBuildMode(mode: any): mode is BuildMode {
  return (
    mode === BuildMode.Development ||
    mode === BuildMode.Production ||
    mode === BuildMode.Test
  );
}

export enum BuildTarget {
  Browser = "browser", // TODO: remove
  Server = "server", // TODO: remove
  CloudflareWorkers = "cloudflare-workers",
  Node14 = "node14",
}
