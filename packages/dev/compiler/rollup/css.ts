import path from "path";
import { promises as fsp } from "fs";
import postcss from "postcss";
import prettyBytes from "pretty-bytes";
import prettyMs from "pretty-ms";
import type { Plugin } from "rollup";
import type Processor from "postcss/lib/processor";

import { BuildTarget } from "../../build";
import { getHash } from "../crypto";
import { log, logInfo } from "../logging";
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
      if (id.startsWith("\0css:")) {
        id = id.slice(5);
      } else {
        return;
      }

      this.addWatchFile(id);

      let url = await processCssAsset(
        processor,
        id,
        config,
        target === BuildTarget.Browser
      );

      return `export default ${JSON.stringify(url)}`;
    }
  };
}

async function processCssAsset(
  processor: Processor,
  id: string,
  config: RemixConfig,
  emit: boolean
) {
  let start = Date.now();

  let source = await fsp.readFile(id);
  let hash = getHash(source, 8);

  let relativeSourcePath = id.replace(config.appDirectory + "/", "");
  let extRegex = /(\.[^/.]+$)/;
  let relativeAssetPath = relativeSourcePath.replace(extRegex, `__${hash}.css`);
  let url = config.publicPath + relativeAssetPath;

  if (emit) {
    let localAssetPath = path.join(
      config.assetsBuildDirectory,
      relativeAssetPath
    );

    if (await assetExists(localAssetPath)) {
      logInfo("css exists, skipping", relativeSourcePath);
    } else {
      let result = await processor.process(source, { from: id });

      await fsp.mkdir(path.dirname(localAssetPath), { recursive: true });
      await fsp.writeFile(localAssetPath, result.css);

      let stats = await fsp.stat(localAssetPath);

      log(
        `Built css: %s, %s, %s`,
        prettyMs(Date.now() - start),
        prettyBytes(stats.size),
        relativeSourcePath
      );
    }
  }

  return url;
}

async function assetExists(filePath: string) {
  try {
    await fsp.access(filePath);
    return true;
  } catch (e) {
    return false;
  }
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
