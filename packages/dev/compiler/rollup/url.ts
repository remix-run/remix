// Code adapted from https://github.com/preactjs/wmr
import path from "path";
import { promises as fs } from "fs";
import type { Plugin } from "rollup";
import { BuildTarget } from "@remix-run/core";

import type { RemixConfig } from "./remixConfig";
import { getRemixConfig } from "./remixConfig";

const IMPLICIT_URL = /\.(?:svg|mp4|webm|ogg|mp3|wav|flac|aac|woff2?|eot|ttf|otf)$/i;

export default function url({ target }: { target: string }): Plugin {
  let config: RemixConfig;

  return {
    name: "url",

    async buildStart({ plugins }) {
      if (!config) config = await getRemixConfig(plugins);
    },

    async resolveId(id, importer) {
      if (id[0] === "\0" || id[0] === "\b") return;

      if (id.startsWith("url:")) {
        // explicit `url:` prefix
        id = id.slice(4);
      } else if (!IMPLICIT_URL.test(id)) {
        return;
      }

      const resolved = await this.resolve(id, importer, { skipSelf: true });
      if (!resolved) return;

      resolved.id = `\0url:${resolved.id}`;
      return resolved;
    },

    resolveFileUrl({ chunkId, relativePath, fileName }) {
      if (target === BuildTarget.Browser) {
        return `new URL('${relativePath}', import.meta.url).pathname`;
      } else {
        return generateServerUrl(chunkId, fileName, config);
      }
    },

    async load(id) {
      if (id.startsWith("\0url:")) {
        id = id.slice(5);
      } else {
        return;
      }

      let name = id.replace(config.appDirectory + "/", "");

      let fileId;
      if (target === BuildTarget.Browser) {
        fileId = this.emitFile({
          type: "asset",
          name: name,
          source: await fs.readFile(id)
        });
      } else {
        fileId = this.emitFile({
          type: "asset",
          name: name,
          source: JSON.stringify(name)
        });
      }

      this.addWatchFile(id);
      return `export default import.meta.ROLLUP_FILE_URL_${fileId}`;
    }
  };
}

function generateServerUrl(chunkId: string, name: string, config: RemixConfig) {
  let manifestPath = path.join(
    config.serverBuildDirectory,
    "asset-manifest.json"
  );
  let importerDir = path.dirname(
    path.join(config.serverBuildDirectory, chunkId)
  );
  let manifestImportPath = path.relative(importerDir, manifestPath);

  return `"${config.publicPath}"+require("./${manifestImportPath}").entries["${name}"].file`;
}
