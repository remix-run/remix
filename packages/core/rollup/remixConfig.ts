import path from "path";
import type { Plugin } from "rollup";

import type { RemixConfig } from "../config";
import { readConfig } from "../config";
import { purgeRequireCache } from "../requireCache";
import invariant from "../invariant";

export default function remixConfig({ rootDir }: { rootDir: string }): Plugin {
  let configPromise: Promise<RemixConfig> | null = null;

  return {
    name: "remix-config",
    options(options) {
      configPromise = null;
      return options;
    },
    buildStart() {
      this.addWatchFile(path.join(rootDir, "remix.config.js"));
    },
    api: {
      getConfig(): Promise<RemixConfig> {
        if (!configPromise) {
          // Purge the require cache in case remix.config.js loads any other
          // files via require().
          purgeRequireCache(rootDir);
          configPromise = readConfig(rootDir);
        }

        return configPromise;
      }
    }
  };
}

export function findConfigPlugin(plugins: Plugin[]): Plugin | undefined {
  return plugins.find(plugin => plugin.name === "remix-config");
}

export function getRemixConfig(plugins: Plugin[]): Promise<RemixConfig> {
  let plugin = findConfigPlugin(plugins);
  invariant(plugin, `Missing remixConfig plugin`);
  return plugin.api.getConfig();
}
