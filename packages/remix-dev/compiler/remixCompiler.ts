import * as path from "path";
import type esbuild from "esbuild";

import type { RemixConfig } from "../config";
import type { AssetsManifest } from "./assets";
import { createAssetsManifest } from "./assets";
import { createBrowserCompiler } from "./compileBrowser";
import { createServerCompiler } from "./compilerServer";
import type { CompileOptions } from "./options";
import { writeFileSafe } from "./utils/fs";

export type CompileResult = {
  assetsManifest: AssetsManifest;
  metafile: {
    browser: esbuild.Metafile;
    server: esbuild.Metafile;
  };
};

type Compiler = {
  compile: () => Promise<CompileResult | undefined>;
  dispose: () => void;
};

export let create = (
  config: RemixConfig,
  options: CompileOptions
): Compiler => {
  let browser = createBrowserCompiler(config, options);
  let server = createServerCompiler(config, options);
  return {
    compile: async () => {
      try {
        let { metafile, hmr, cssBundleHref } = await browser.compile();
        let manifest = await createAssetsManifest({
          config,
          metafile: metafile,
          cssBundleHref,
          hmr,
        });
        let [serverMetafile] = await Promise.all([
          server.compile(manifest),
          writeAssetsManifest(config, manifest),
        ]);

        return {
          assetsManifest: manifest,
          metafile: {
            browser: metafile,
            server: serverMetafile,
          },
        };
      } catch (error: unknown) {
        options.onCompileFailure?.(error as Error);
        return undefined;
      }
    },
    dispose: () => {
      browser.dispose();
      server.dispose();
    },
  };
};

const writeAssetsManifest = async (
  config: RemixConfig,
  assetsManifest: AssetsManifest
) => {
  let filename = `manifest-${assetsManifest.version.toUpperCase()}.js`;

  assetsManifest.url = config.publicPath + filename;

  await writeFileSafe(
    path.join(config.assetsBuildDirectory, filename),
    `window.__remixManifest=${JSON.stringify(assetsManifest)};`
  );
};
