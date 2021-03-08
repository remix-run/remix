import path from "path";
import { promises as fsp } from "fs";
import postcss from "postcss";
import type Processor from "postcss/lib/processor";
import type { Plugin } from "rollup";

import { BuildTarget } from "../../build";
import createUrl from "../createUrl";
import { getHash, addHash, getFileHash } from "../crypto";
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
      if (id[0] === "\0" || !id.startsWith("css:")) return;
      id = id.slice(4);

      let resolved = await this.resolve(id, importer, { skipSelf: true });

      return resolved && `\0css:${resolved.id}`;
    },

    async load(id) {
      if (!id.startsWith("\0css:")) return;
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

      if (!id.startsWith("\0css:")) return;
      id = id.slice(5);

      let source = await fsp.readFile(id);
      let fileName = addHash(
        path.relative(config.appDirectory, id),
        getHash(source).slice(0, 8)
      );

      this.emitFile({
        type: "asset",
        fileName,
        source: await generateCssSource(id, source, processor)
      });

      return code;
    }
  };
}

async function generateCssSource(
  file: string,
  content: Buffer,
  processor: Processor
): Promise<string> {
  console.log(`generating CSS for ${file}`);
  let result = await processor.process(content, { from: file });
  return result.css;
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
