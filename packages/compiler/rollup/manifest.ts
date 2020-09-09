import path from "path";
import { promises as fsp } from "fs";
import type { NormalizedOutputOptions, OutputBundle, Plugin } from "rollup";

interface ManifestEntry {
  imports: string[];
  requirePath: string;
}

type RouteId = string;
type Manifest = Record<RouteId, ManifestEntry>;

function createManifest(outputDir: string, bundle: OutputBundle): Manifest {
  return Object.keys(bundle).reduce((manifest, key) => {
    let assetOrChunk = bundle[key];

    if (assetOrChunk.type === "chunk") {
      manifest[assetOrChunk.name] = {
        imports: assetOrChunk.imports,
        requirePath: path.join(outputDir, assetOrChunk.fileName)
      };
    }

    return manifest;
  }, {} as Manifest);
}

export default function manifestPlugin({
  filename = "manifest.json",
  outputDir
}: {
  filename?: string;
  outputDir: string;
}): Plugin {
  return {
    name: "manifest-plugin",
    async generateBundle(
      _options: NormalizedOutputOptions,
      bundle: OutputBundle,
      isWrite: boolean
    ) {
      let manifest = createManifest(outputDir, bundle);
      console.log({ manifest });

      if (isWrite) {
        let file = path.join(outputDir, filename);
        await fsp.writeFile(file, JSON.stringify(manifest));
      }
    }
  };
}
