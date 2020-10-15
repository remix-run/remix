import path from "path";
import { promises as fsp } from "fs";
import type { NormalizedOutputOptions, OutputBundle, Plugin } from "rollup";

export interface BuildManifest {
  [chunkName: string]: BuildChunk;
}

export interface BuildChunk {
  fileName: string;
  imports?: string[];
}

function createManifest(bundle: OutputBundle): BuildManifest {
  return Object.keys(bundle).reduce((manifest, key) => {
    let assetOrChunk = bundle[key];

    if (assetOrChunk.type === "chunk") {
      if (assetOrChunk.isEntry) {
        manifest[assetOrChunk.name] = {
          fileName: assetOrChunk.fileName,
          imports: assetOrChunk.imports
        };
      }
    } else if (
      assetOrChunk.type === "asset" &&
      typeof assetOrChunk.name !== "undefined"
    ) {
      manifest[assetOrChunk.name] = {
        fileName: assetOrChunk.fileName
      };
    }

    return manifest;
  }, {} as BuildManifest);
}

export default function manifestPlugin({
  fileName = "manifest.json",
  outputDir = "."
}: {
  fileName?: string;
  forceWrite?: boolean;
  outputDir?: string;
}): Plugin {
  return {
    name: "manifest",
    async generateBundle(
      _options: NormalizedOutputOptions,
      bundle: OutputBundle,
      isWrite: boolean
    ) {
      let manifest = createManifest(bundle);

      if (isWrite) {
        let file = path.join(outputDir, fileName);
        await fsp.mkdir(path.dirname(file), { recursive: true });
        await fsp.writeFile(file, JSON.stringify(manifest));
      } else {
        this.emitFile({
          type: "asset",
          fileName: fileName,
          source: JSON.stringify(manifest)
        });
      }
    }
  };
}
