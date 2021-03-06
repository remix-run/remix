import path from "path";
import { promises as fsp } from "fs";
import postcss from "postcss";
import type Processor from "postcss/lib/processor";
import type { Plugin } from "rollup";

import { BuildTarget } from "../../build";
import createUrl from "../createUrl";
import { getHash, addHash } from "../crypto";
import type { RemixConfig } from "./remixConfig";
import { getRemixConfig } from "./remixConfig";

// const IMPLICIT_URL = /\.(?:css|less|scss|sass)$/i;

export default function cssPlugin({
  target,
  mode
}: {
  target: string;
  mode: string;
}): Plugin {
  let config: RemixConfig;
  let processor: Processor;

  return {
    name: "css",

    async buildStart({ plugins }) {
      config = await getRemixConfig(plugins);

      if (!processor) {
        let postCssConfig = await getPostCssConfig(config.rootDirectory, mode);
        processor = postcss(postCssConfig.plugins);
      }
    },

    async resolveId(id, importer) {
      if (id[0] === "\0" || id[0] === "\b") return;

      if (id.startsWith("css:")) {
        id = id.slice(4);
        // } else if (!IMPLICIT_URL.test(id)) {
        //   return;
      } else {
        return;
      }

      const resolved = await this.resolve(id, importer, { skipSelf: true });
      if (!resolved) return;

      resolved.id = `\0css:${resolved.id}`;
      return resolved;
    },

    async load(id) {
      if (!id.startsWith("\0css:")) return;
      id = id.slice(5);

      this.addWatchFile(id);

      let source = await fsp.readFile(id);
      let fileName = addHash(
        path.relative(config.appDirectory, id),
        getHash(source, 8)
      );

      return `export default ${JSON.stringify(
        createUrl(config.publicPath, fileName)
      )}`;
    },

    async transform(code, id) {
      if (!id.startsWith("\0css:")) return;
      id = id.slice(5);

      if (target !== BuildTarget.Browser) return;

      let source = await fsp.readFile(id);
      let fileName = addHash(
        path.relative(config.appDirectory, id),
        getHash(source, 8)
      );

      console.log(`processing CSS for ${id}`);
      let result = await processor.process(source, { from: id });

      this.emitFile({ type: "asset", fileName, source: result.css });

      return code;
    }
  };
}

async function getPostCssConfig(appDirectory: string, mode: string) {
  let requirePath = path.resolve(appDirectory, "postcss.config.js");
  try {
    await fsp.access(requirePath);
    return require(requirePath);
  } catch (e) {
    return { plugins: mode ? [] : [] };
  }
}
