import "./modules";

export type { AppConfig, RemixConfig as ResolvedRemixConfig } from "./config";

export * as cli from "./cli/index";

export type { Manifest as AssetsManifest } from "./manifest";
export type {
  DefineRoutesFunction as UNSAFE_DefineRoutesFunction,
  RouteManifest as UNSAFE_RouteManifest,
  RouteManifestEntry as UNSAFE_RouteManifestEntry,
  RouteConfig as UNSAFE_RouteConfig,
  RouteConfigEntry as UNSAFE_RouteConfigEntry,
} from "./config/routes";
export {
  defineRoutes as UNSAFE_defineRoutes,
  routeManifestToRouteConfig as UNSAFE_routeManifestToRouteConfig,
  getRouteConfigAppDirectory as UNSAFE_getRouteConfigAppDirectory,
} from "./config/routes";
export { flatRoutes as UNSAFE_flatRoutes } from "./config/flat-routes";
export { getDependenciesToBundle } from "./dependencies";
export type {
  BuildManifest,
  Preset,
  ServerBundlesFunction,
  VitePluginConfig,
} from "./vite";
export { vitePlugin, cloudflareDevProxyVitePlugin } from "./vite";
