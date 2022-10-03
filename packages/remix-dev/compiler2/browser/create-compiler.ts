import path from "path";
import type { BuildIncremental } from "esbuild";
import esbuild from "esbuild";

import type { AssetsManifest } from "../../compiler/assets";
import { createAssetsManifest } from "../../compiler/assets";
import { writeFileSafe } from "../../compiler/utils/fs";
import type { RemixConfig } from "../../config";
import { createEsbuildConfig } from "./config";
import type { BrowserCompiler } from "../../compiler-kit";
import type { WriteChannel } from "../../compiler-kit/utils/channel";
import type { CreateCompiler } from "../../compiler-kit/interface";

async function generateAssetsManifest(
  config: RemixConfig,
  metafile: esbuild.Metafile
): Promise<AssetsManifest> {
  let assetsManifest = await createAssetsManifest(config, metafile);
  let filename = `manifest-${assetsManifest.version.toUpperCase()}.js`;

  assetsManifest.url = config.publicPath + filename;

  await writeFileSafe(
    path.join(config.assetsBuildDirectory, filename),
    `window.__remixManifest=${JSON.stringify(assetsManifest)};`
  );

  return assetsManifest;
}

export const createBrowserCompiler: CreateCompiler<BrowserCompiler> = (
  remixConfig,
  options
) => {
  let compiler: BuildIncremental | undefined = undefined;
  let esbuildConfig = createEsbuildConfig(remixConfig, options);
  let build = async (manifestChannel: WriteChannel<AssetsManifest>) => {
    if (compiler === undefined) {
      compiler = await esbuild.build({
        ...esbuildConfig,
        metafile: true,
        incremental: true,
      });
      let manifest = await generateAssetsManifest(
        remixConfig,
        compiler.metafile!
      );
      manifestChannel.write(manifest);
    } else {
      let { metafile } = await compiler.rebuild();
      let manifest = await generateAssetsManifest(remixConfig, metafile!);
      manifestChannel.write(manifest);
    }
  };
  return {
    build,
    dispose: () => compiler?.rebuild.dispose(),
  };
};
