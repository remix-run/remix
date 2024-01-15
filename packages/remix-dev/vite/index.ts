// This file allows us to dynamically require the plugin so non-Vite consumers
// don't need to have Vite installed as a peer dependency. Only types should
// be imported at the top level.
import type { RemixVitePlugin } from "./plugin";
export type {
  ServerBundlesManifest as Unstable_ServerBundlesManifest,
  RemixVitePluginOptions as Unstable_RemixVitePluginOptions,
  RemixVitePluginAdapter as Unstable_RemixVitePluginAdapter,
} from "./plugin";

export const unstable_vitePlugin: RemixVitePlugin = (...args) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  let { remixVitePlugin } = require("./plugin") as typeof import("./plugin");
  return remixVitePlugin(...args);
};
