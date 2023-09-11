import * as path from "node:path";
import fse from "fs-extra";
import type * as esbuild from "esbuild";
import postcss from "postcss";
import postcssDiscardDuplicates from "postcss-discard-duplicates";

import type { Context } from "../context";

export async function write(ctx: Context, outputFiles: esbuild.OutputFile[]) {
  let cssBundleFile = outputFiles.find((outputFile) =>
    isCssBundleFile(ctx, outputFile, ".css")
  );
  if (!cssBundleFile) return;

  let cssBundlePath = cssBundleFile.path;

  let { css, map } = await postcss([
    // We need to discard duplicate rules since "composes"
    // in CSS Modules can result in duplicate styles
    postcssDiscardDuplicates(),
  ]).process(cssBundleFile.text, {
    from: cssBundlePath,
    to: cssBundlePath,
    map: ctx.options.sourcemap && {
      prev: outputFiles.find((outputFile) =>
        isCssBundleFile(ctx, outputFile, ".css.map")
      )?.text,
      inline: false,
      annotation: false,
      sourcesContent: true,
    },
  });

  await fse.ensureDir(path.dirname(cssBundlePath));

  await Promise.all([
    fse.writeFile(cssBundlePath, css),
    ctx.options.mode !== "production" && map
      ? fse.writeFile(`${cssBundlePath}.map`, map.toString()) // Write our updated source map rather than esbuild's
      : null,
    ...outputFiles
      .filter((outputFile) => !/\.(css|js|map)$/.test(outputFile.path))
      .map(async (asset) => {
        await fse.ensureDir(path.dirname(asset.path));
        await fse.writeFile(asset.path, asset.contents);
      }),
  ]);
}

function isCssBundleFile(
  ctx: Context,
  outputFile: esbuild.OutputFile,
  extension: ".js" | ".css" | ".css.map"
): boolean {
  return (
    path.dirname(outputFile.path) === ctx.config.assetsBuildDirectory &&
    path.basename(outputFile.path).startsWith("css-bundle") &&
    outputFile.path.endsWith(extension)
  );
}

type CssBundleFiles = {
  js: esbuild.OutputFile;
  css?: esbuild.OutputFile;
};

export function getCssBundleFiles(
  ctx: Context,
  files: esbuild.OutputFile[]
): CssBundleFiles {
  let js = files.find((file) => isCssBundleFile(ctx, file, ".js"));

  if (!js) {
    throw new Error("Could not find JavaScript output from CSS bundle build");
  }

  let css = files.find((file) => isCssBundleFile(ctx, file, ".css"));

  return { js, css };
}
