import type { Plugin } from "rollup";
import { BuildTarget } from "@remix-run/core";

import * as Images from "../images";
import type { RemixConfig } from "./remixConfig";
import { getRemixConfig } from "./remixConfig";

export default function imgPlugin({ target }: { target: string }): Plugin {
  let config: RemixConfig;
  let cleanupEmissions: ReturnType<typeof Images.trackEmissions>;

  return {
    name: "img",

    async buildStart({ plugins }) {
      if (!config) config = await getRemixConfig(plugins);
      if (target === BuildTarget.Browser) {
        cleanupEmissions = Images.trackEmissions();
      }
    },

    async resolveId(id, importer) {
      if (id[0] === "\0" || id[0] === "\b" || !id.startsWith("img:")) {
        return;
      }

      let [fileName, search] = id.slice(4).split("?");

      let resolved = await this.resolve(fileName, importer, { skipSelf: true });
      if (!resolved) return;

      let resolvedId = resolved.id;
      if (search) resolvedId += `?${search}`;

      resolved.id = `\0img:${resolvedId}`;
      return resolved;
    },

    async load(id) {
      if (!id.startsWith("\0img:")) {
        return;
      }

      id = id.slice(5);
      this.addWatchFile(id.split("?")[0]);
      let emit = target === BuildTarget.Browser;

      return Images.getImageAssetModule(id, config, emit);
    },

    async buildEnd() {
      if (target === BuildTarget.Browser) {
        await cleanupEmissions();
      }
    }
  };
}
