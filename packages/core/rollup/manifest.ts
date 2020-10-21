import path from "path";
import { promises as fsp } from "fs";
import crypto from "crypto";
import type { NormalizedOutputOptions, OutputBundle, Plugin } from "rollup";

export interface BuildManifest {
  version: string;
  entries: {
    [entryName: string]: {
      fileName: string;
      imports?: string[];
    };
  };
}

function createChecksum(bundle: OutputBundle): string {
  let keys = Object.keys(bundle).sort();
  let hash = crypto.createHash("sha1");

  for (let key of keys) {
    let assetOrChunk = bundle[key];
    if (assetOrChunk.type === "asset") {
      hash.update(assetOrChunk.source);
    } else {
      hash.update(assetOrChunk.code);
    }
  }

  return hash.digest("hex");
}

function createEntries(bundle: OutputBundle): BuildManifest["entries"] {
  let manifest: BuildManifest["entries"] = {};

  for (let key of Object.keys(bundle)) {
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
  }

  return manifest;
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
      let manifest: BuildManifest = {
        version: createChecksum(bundle).slice(0, 8),
        entries: createEntries(bundle)
      };

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
