import path from "path";
import type { BuildIncremental, BuildOptions } from "esbuild";
import esbuild from "esbuild";

import type { BrowserCompiler, ServerCompiler } from "../compiler-interface";
import type { ReadChannel, WriteChannel } from "../compiler-interface/channel";
import type { CreateCompiler } from "../compiler-interface/compiler";
import type { AssetsManifest } from "../compiler/assets";
import { createAssetsManifest } from "../compiler/assets";
import { writeFileSafe } from "../compiler/utils/fs";
import type { RemixConfig } from "../config";
import { serverAssetsManifestPlugin } from "./serverAssetsManifestPlugin";

// browser compiler `build` should do a fresh build the first time its called, but reuse the compiler subsequently

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

// TODO: change `config` to `getConfig`: `(RemixConfig) => BuildOptions`
export const createBrowserCompiler =
  (config: BuildOptions): CreateCompiler<BrowserCompiler> =>
  (remixConfig) => {
    let compiler: BuildIncremental | undefined = undefined;
    let build = async (manifestChannel: WriteChannel<AssetsManifest>) => {
      if (compiler === undefined) {
        compiler = await esbuild.build({
          ...config,
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

// TODO: change `config` to `getConfig`: `(RemixConfig) => BuildOptions`
export const createServerCompiler =
  (config: BuildOptions): CreateCompiler<ServerCompiler> =>
  (remixConfig) => {
    let build = async (manifestChannel: ReadChannel<AssetsManifest>) => {
      let manifestPromise = manifestChannel.read();

      await esbuild.build({
        ...config,
        plugins: [
          ...(config.plugins ?? []),
          serverAssetsManifestPlugin(manifestPromise),
        ],
      });
    };
    return {
      build,
      dispose: () => undefined,
    };
  };
