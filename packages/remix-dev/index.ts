import "./modules";

export type { AppConfig, RemixConfig as ResolvedRemixConfig } from "./config";

export * as cli from "./cli/index";

export type { Manifest as AssetsManifest } from "./manifest";
export type {
  RouteConfig as UNSAFE_RouteConfig,
  RouteConfigEntry as UNSAFE_RouteConfigEntry,
} from "./config/routes";
export { getRouteConfigAppDirectory as UNSAFE_getRouteConfigAppDirectory } from "./config/routes";
export { getDependenciesToBundle } from "./dependencies";
export type {
  BuildManifest,
  Preset,
  ServerBundlesFunction,
  VitePluginConfig,
} from "./vite";
export { vitePlugin, cloudflareDevProxyVitePlugin } from "./vite";
