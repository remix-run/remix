import * as path from "path";
import type esbuild from "esbuild";

import type { RemixConfig } from "../config";
import type { AssetsManifest } from "./assets";
import { createAssetsManifest } from "./assets";
import * as BrowserJS from "./browserjs";
import * as ServerJS from "./serverjs";
import type { CompileOptions } from "./options";
import { writeFileSafe } from "./utils/fs";
import type { Channel } from "../channel";
import { createChannel } from "../channel";
import * as CSS from "./css";

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
  let cssBundleHrefChannel: Channel<string | undefined>;
  let writeCssBundleHref = (cssBundleHref?: string) =>
    cssBundleHrefChannel.write(cssBundleHref);
  let readCssBundleHref = () => cssBundleHrefChannel.read();
  let css = CSS.compiler.create(config, options, writeCssBundleHref);
  let browser = BrowserJS.compiler.create(config, options, readCssBundleHref);
  let server = ServerJS.compiler.create(config, options);
  return {
    compile: async () => {
      // TODO: only reset cssBundleHrefChannel if css bundling is enabled?
      // otherwise we could just write `undefined` to the channel immediately
      cssBundleHrefChannel = createChannel();
      try {
        let [cssBundleHref, { metafile, hmr }] = await Promise.all([
          css.compile(),
          browser.compile(),
        ]);
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
      css.dispose();
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
