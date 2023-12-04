import colors from "picocolors";

import type { ResolvedRemixVitePluginConfig } from "./plugin";

export async function extractPluginConfig({
  root,
  mode,
  configFile,
}: {
  root: string;
  mode?: string;
  configFile?: string;
}): Promise<ResolvedRemixVitePluginConfig> {
  let vite = await import("vite");

  // Leverage the Vite config as a way to configure the entire multi-step build
  // process so we don't need to have a separate Remix config
  let viteConfig = await vite.resolveConfig(
    { mode, configFile, root },
    "build"
  );

  // Our use of a child compiler requires a config file be present so that we
  // can dynamically create an independent copy of the Vite plugins array.
  if (!viteConfig.configFile) {
    console.error(
      colors.red("The Remix Vite plugin requires the use of a Vite config file")
    );
    process.exit(1);
  }

  let pluginConfig = viteConfig[
    "__remixPluginResolvedConfig" as keyof typeof viteConfig
  ] as ResolvedRemixVitePluginConfig | undefined;
  if (!pluginConfig) {
    console.error(colors.red("Remix Vite plugin not found in Vite config"));
    process.exit(1);
  }

  return pluginConfig;
}
