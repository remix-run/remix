import * as path from "path";
import type esbuild from "esbuild";

import type { RemixConfig } from "../config";
import type { AssetsManifest } from "./assets";
import { createAssetsManifest } from "./assets";
import type { BrowserCompiler } from "./compileBrowser";
import { createBrowserCompiler } from "./compileBrowser";
import type { ServerCompiler } from "./compilerServer";
import { createServerCompiler } from "./compilerServer";
import type { OnCompileFailure } from "./onCompileFailure";
import type { CompileOptions } from "./options";
import { writeFileSafe } from "./utils/fs";

type RemixCompiler = {
  config: RemixConfig;
  browser: BrowserCompiler;
  server: ServerCompiler;
};

export const createRemixCompiler = (
  remixConfig: RemixConfig,
  options: CompileOptions
): RemixCompiler => {
  return {
    config: remixConfig,
    browser: createBrowserCompiler(remixConfig, options),
    server: createServerCompiler(remixConfig, options),
  };
};

export type CompileResult = {
  assetsManifest: AssetsManifest;
  metafile: {
    browser: esbuild.Metafile;
    server: esbuild.Metafile;
  };
};

export const compile = async (
  compiler: RemixCompiler,
  options: {
    onCompileFailure?: OnCompileFailure;
  } = {}
): Promise<CompileResult | undefined> => {
  try {
    let { metafile, hmr, cssBundleHref } = await compiler.browser.compile();
    let manifest = await createAssetsManifest({
      config: compiler.config,
      metafile: metafile,
      cssBundleHref,
      hmr,
    });
    let [serverMetafile] = await Promise.all([
      compiler.server.compile(manifest),
      writeAssetsManifest(compiler.config, manifest),
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
};

export const dispose = (compiler: RemixCompiler): void => {
  compiler.browser.dispose();
  compiler.server.dispose();
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
