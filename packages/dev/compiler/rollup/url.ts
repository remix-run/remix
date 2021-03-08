import path from "path";
import { promises as fsp } from "fs";
import type { Plugin } from "rollup";

import { BuildTarget } from "../../build";
import createUrl from "../createUrl";
import { getHash, addHash, getFileHash } from "../crypto";
import type { RemixConfig } from "./remixConfig";
import { getRemixConfig } from "./remixConfig";

const IMPLICIT_URL = /\.(?:svg|mp4|webm|ogg|mp3|wav|flac|aac|woff2?|eot|ttf|otf)$/i;

export default function urlPlugin({ target }: { target: string }): Plugin {
  let config: RemixConfig;

  return {
    name: "url",

    async buildStart({ plugins }) {
      config = await getRemixConfig(plugins);
    },

    async resolveId(id, importer) {
      if (id[0] === "\0") return;

      if (id.startsWith("url:")) {
        id = id.slice(4);
      } else if (!IMPLICIT_URL.test(id)) {
        return;
      }

      let resolved = await this.resolve(id, importer, { skipSelf: true });

      return resolved && `\0url:${resolved.id}`;
    },

    async load(id) {
      if (!id.startsWith("\0url:")) return;
      id = id.slice(5);

      this.addWatchFile(id);

      let hash = (await getFileHash(id)).slice(0, 8);
      let fileName = addHash(path.relative(config.appDirectory, id), hash);

      return `export default ${JSON.stringify(
        createUrl(config.publicPath, fileName)
      )}`;
    },

    async transform(code, id) {
      if (target !== BuildTarget.Browser) return;

      if (!id.startsWith("\0url:")) return;
      id = id.slice(5);

      let source = await fsp.readFile(id);
      let fileName = addHash(
        path.relative(config.appDirectory, id),
        getHash(source).slice(0, 8)
      );

      this.emitFile({ type: "asset", fileName, source });

      return code;
    }
  };
}
