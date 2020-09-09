import * as rollup from "rollup";

export function debugBundle(bundle: rollup.RollupOutput): any {
  return bundle.output.reduce((memo, chunkOrAsset) => {
    if (chunkOrAsset.type === "chunk") {
      memo[chunkOrAsset.fileName] = debugChunk(chunkOrAsset);
    } else if (chunkOrAsset.type === "asset") {
      memo[chunkOrAsset.fileName] = chunkOrAsset;
    }

    return memo;
  }, {} as any);
}

export function debugChunk(chunk: rollup.OutputChunk): any {
  return {
    type: chunk.type,
    name: chunk.name,
    fileName: chunk.fileName,
    isEntry: chunk.isEntry,
    isDynamicEntry: chunk.isDynamicEntry,
    isImplicitEntry: chunk.isImplicitEntry,
    imports: chunk.imports,
    exports: chunk.exports,
    modules: Object.keys(chunk.modules)
  };
}
