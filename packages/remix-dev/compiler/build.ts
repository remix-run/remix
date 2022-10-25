import * as path from "path";
import * as esbuild from "esbuild";

import type { BuildOptions } from "./build";
import type { RemixConfig } from "./config";
import { warnOnce } from "./compiler/warnings";
import type { AssetsManifest } from "./compiler/assets";
import { createAssetsManifest } from "./compiler/assets";
import type { AssetsManifestPromiseRef } from "./compiler/plugins/serverAssetsManifestPlugin";
import { writeFileSafe } from "./compiler/utils/fs";
import {
  createServerBuild,
  writeServerBuildResult,
} from "./compiler/compile-server";
import { createBrowserBuild } from "./compiler/compile-browser";

function defaultWarningHandler(message: string, key: string) {
  warnOnce(message, key);
}

export type BuildError = Error | esbuild.BuildFailure;
function defaultBuildFailureHandler(failure: BuildError) {
  formatBuildFailure(failure);
}

export function formatBuildFailure(failure: BuildError) {
  if ("warnings" in failure || "errors" in failure) {
    if (failure.warnings) {
      let messages = esbuild.formatMessagesSync(failure.warnings, {
        kind: "warning",
        color: true,
      });
      console.warn(...messages);
    }

    if (failure.errors) {
      let messages = esbuild.formatMessagesSync(failure.errors, {
        kind: "error",
        color: true,
      });
      console.error(...messages);
    }
  }

  console.error(failure?.message || "An unknown build error occurred");
}

export async function build(
  config: RemixConfig,
  {
    mode = "production",
    target = "node14",
    sourcemap = false,
    onWarning = defaultWarningHandler,
    onBuildFailure = defaultBuildFailureHandler,
  }: Partial<BuildOptions> = {}
): Promise<void> {
  let assetsManifestPromiseRef: AssetsManifestPromiseRef = {};

  await buildEverything(config, assetsManifestPromiseRef, {
    mode,
    target,
    sourcemap,
    onWarning,
    onBuildFailure,
  });
}

///////////////////////////////////////////////////////////////////////////////

async function buildEverything(
  config: RemixConfig,
  assetsManifestPromiseRef: AssetsManifestPromiseRef,
  options: BuildOptions & { incremental?: boolean }
): Promise<(esbuild.BuildResult | undefined)[]> {
  try {
    let browserBuildPromise = createBrowserBuild(config, options);
    let assetsManifestPromise = browserBuildPromise.then((build) =>
      generateAssetsManifest(config, build.metafile!)
    );

    // Assign the assetsManifestPromise to a ref so the server build can await
    // it when loading the @remix-run/dev/assets-manifest virtual module.
    assetsManifestPromiseRef.current = assetsManifestPromise;

    let serverBuildPromise = createServerBuild(
      config,
      options,
      assetsManifestPromiseRef
    );

    return await Promise.all([
      assetsManifestPromise.then(() => browserBuildPromise),
      serverBuildPromise,
    ]);
  } catch (err) {
    options.onBuildFailure?.(err as Error);
    return [undefined, undefined];
  }
}

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
