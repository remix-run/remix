import * as path from "path";
import * as fse from "fs-extra";
import esbuild from "esbuild";
import type { Processor } from "postcss";
import chokidar from "chokidar";
import picomatch from "picomatch";

import invariant from "../../invariant";
import type { RemixConfig } from "../../config";
import type { Options } from "../options";
import { getPostcssProcessor } from "../utils/postcss";
import { absoluteCssUrlsPlugin } from "./absoluteCssUrlsPlugin";

const isExtendedLengthPath = /^\\\\\?\\/;

function normalizePathSlashes(p: string) {
  return isExtendedLengthPath.test(p) ? p : p.replace(/\\/g, "/");
}

/**
 * This plugin loads css files with the "css" loader (bundles and moves assets to assets directory)
 * and exports the url of the css file as its default export.
 */
export function cssFilePlugin({
  config,
  options,
}: {
  config: RemixConfig;
  options: Options;
}): esbuild.Plugin {
  return {
    name: "css-file",

    async setup(build) {
      let {
        absWorkingDir,
        assetNames,
        chunkNames,
        conditions,
        define,
        external,
        sourceRoot,
        treeShaking,
        tsconfig,
        format,
        loader,
        mainFields,
        nodePaths,
        platform,
        publicPath,
        target,
      } = build.initialOptions;

      let postcssProcessor = await getPostcssProcessor({ config });

      build.onLoad({ filter: /\.css$/ }, async (args) => {
        let { metafile, outputFiles, warnings, errors } = await esbuild.build({
          absWorkingDir,
          assetNames,
          chunkNames,
          conditions,
          define,
          external,
          format,
          mainFields,
          nodePaths,
          platform,
          publicPath,
          sourceRoot,
          target,
          treeShaking,
          tsconfig,
          minify: options.mode === "production",
          bundle: true,
          minifySyntax: true,
          metafile: true,
          write: false,
          sourcemap: Boolean(options.sourcemap && postcssProcessor), // We only need source maps if we're processing the CSS with PostCSS
          splitting: false,
          outdir: config.assetsBuildDirectory,
          entryNames: assetNames,
          entryPoints: [args.path],
          loader: {
            ...loader,
            ".css": "css",
          },
          plugins: [
            absoluteCssUrlsPlugin(),
            ...(postcssProcessor
              ? [postcssPlugin({ postcssProcessor, options })]
              : []),
          ],
        });

        if (errors && errors.length) {
          return { errors };
        }

        invariant(metafile, "metafile is missing");
        let { outputs } = metafile;
        let entry = Object.keys(outputs).find((out) => outputs[out].entryPoint);
        invariant(entry, "entry point not found");

        let normalizedEntry = path.resolve(
          config.rootDirectory,
          normalizePathSlashes(entry)
        );
        let entryFile = outputFiles.find((file) => {
          return (
            path.resolve(
              config.rootDirectory,
              normalizePathSlashes(file.path)
            ) === normalizedEntry
          );
        });

        invariant(entryFile, "entry file not found");

        let outputFilesWithoutEntry = outputFiles.filter(
          (file) => file !== entryFile
        );

        // write all assets
        await Promise.all(
          outputFilesWithoutEntry.map(({ path: filepath, contents }) =>
            fse.outputFile(filepath, contents)
          )
        );

        return {
          contents: entryFile.contents,
          loader: "file",
          // add all css assets to watchFiles
          watchFiles: Object.values(outputs).reduce<string[]>(
            (arr, { inputs }) => {
              let resolvedInputs = Object.keys(inputs).map((input) => {
                return path.resolve(input);
              });
              arr.push(...resolvedInputs);
              return arr;
            },
            []
          ),
          warnings,
        };
      });
    },
  };
}

const _globMatchers = new Map<string, ReturnType<typeof picomatch>>();
function getGlobMatcher(glob: string) {
  if (!_globMatchers.has(glob)) {
    _globMatchers.set(glob, picomatch(glob));
  }
  return _globMatchers.get(glob);
}

function getPostcssCompiler({
  postcssProcessor,
  sourcemap,
}: {
  postcssProcessor: Processor;
  sourcemap: boolean;
}) {
  let watcher = chokidar.watch([], {
    ignoreInitial: true,
  });

  let cachedCssForEntryPoint = new Map<string, Promise<string>>();

  let fileDepsForEntryPoint = new Map<string, Set<string>>();
  let entryPointsForFileDep = new Map<string, Set<string>>();

  // Glob dependencies are used for Tailwind
  // e.g. Tailwind directives like `@tailwind utilities` output a bunch of
  // CSS that changes based on the contents of all TS/JS files in the project
  // via a glob in the Tailwind config.
  let globDepsForEntryPoint = new Map<string, Set<string>>();
  let entryPointsForGlobDep = new Map<string, Set<string>>();

  function invalidateEntryPoint(invalidatedEntryPoint: string) {
    // If it's not an entry point (or doesn't have a cache entry), bail out
    if (!cachedCssForEntryPoint.has(invalidatedEntryPoint)) {
      return;
    }

    cachedCssForEntryPoint.delete(invalidatedEntryPoint);

    // Reset tracked deps for entry point. Since we're going to recompile,
    // the entry point will get new deps.
    let fileDeps = fileDepsForEntryPoint.get(invalidatedEntryPoint);
    if (fileDeps) {
      for (let fileDep of fileDeps) {
        entryPointsForFileDep.get(fileDep)?.delete(invalidatedEntryPoint);
      }
      fileDepsForEntryPoint.delete(invalidatedEntryPoint);
    }

    // Reset tracked glob dependencies for entry point. Since we're going to
    // recompile, the entry point will get new glob dependencies.
    let globDeps = globDepsForEntryPoint.get(invalidatedEntryPoint);
    if (globDeps) {
      for (let glob of globDeps) {
        entryPointsForGlobDep.get(glob)?.delete(invalidatedEntryPoint);
      }
      globDepsForEntryPoint.delete(invalidatedEntryPoint);
    }
  }

  function invalidatePath(invalidatedPath: string) {
    console.log("invalidate path", { invalidatedPath });

    // This might be an entry point so we invalidate it just in case.
    invalidateEntryPoint(invalidatedPath);

    // Invalidate all entry points that depend on path.
    let entryPoints = entryPointsForFileDep.get(invalidatedPath);
    if (entryPoints) {
      for (let entryPoint of entryPoints) {
        console.log("Invalidate entry point for file dep", {
          invalidatedPath,
          entryPoint,
        });
        invalidateEntryPoint(entryPoint);
      }
    }

    // Invalidate all entry points that depend on a glob that matches the path.
    // Any glob could match the path, so we have to check all globs.
    for (let [glob, entryPoints] of entryPointsForGlobDep) {
      let match = getGlobMatcher(glob);
      if (match && match(invalidatedPath)) {
        for (let entryPoint of entryPoints) {
          console.log("Invalidate entry point for glob match", {
            glob,
            invalidatedPath,
            entryPoint,
          });
          invalidateEntryPoint(entryPoint);
        }
      }
    }
  }

  watcher.on("change", (changedPath) => {
    invalidatePath(changedPath);
  });

  watcher.on("unlink", (unlinkedPath) => {
    invalidatePath(unlinkedPath);
  });

  let compiler = {
    async processFile(entryPoint: string) {
      if (cachedCssForEntryPoint.has(entryPoint)) {
        console.log("Cache hit", { entryPoint });
        return await cachedCssForEntryPoint.get(entryPoint);
      }

      console.log("Cache miss", { entryPoint });

      let postCssPromise = fse
        .readFile(entryPoint, "utf-8")
        .then(async (contents) => {
          let result = await postcssProcessor.process(contents, {
            from: entryPoint,
            to: entryPoint,
            map: sourcemap,
          });

          let newDeps = new Set<string>();
          let newGlobDeps = new Set<string>();

          for (let msg of result.messages) {
            if (msg.type === "dependency" && typeof msg.file === "string") {
              newDeps.add(msg.file);
              continue;
            }

            if (
              msg.type === "dir-dependency" &&
              typeof msg.dir === "string" &&
              typeof msg.glob === "string"
            ) {
              newGlobDeps.add(path.join(msg.dir, msg.glob));
              continue;
            }
          }

          fileDepsForEntryPoint.set(entryPoint, newDeps);
          globDepsForEntryPoint.set(entryPoint, newGlobDeps);

          // Track the file dependencies of this entry point
          for (let newDep of newDeps) {
            let entryPoints = entryPointsForFileDep.get(newDep);
            if (!entryPoints) {
              entryPoints = new Set();
              entryPointsForFileDep.set(newDep, entryPoints);
            }
            entryPoints.add(entryPoint);
          }

          // Track the glob dependencies of this entry point
          for (let newGlobDep of newGlobDeps) {
            let entryPoints = entryPointsForGlobDep.get(newGlobDep);
            if (!entryPoints) {
              entryPoints = new Set();
              entryPointsForGlobDep.set(newGlobDep, entryPoints);
            }
            entryPoints.add(entryPoint);
          }

          watcher.add([entryPoint, ...newDeps, ...newGlobDeps]);

          return result.css;
        });

      cachedCssForEntryPoint.set(entryPoint, postCssPromise);

      return await postCssPromise;
    },
  };

  return compiler;
}
let postcssCompiler: ReturnType<typeof getPostcssCompiler>;

function postcssPlugin({
  postcssProcessor,
  options,
}: {
  postcssProcessor: Processor;
  options: Options;
}): esbuild.Plugin {
  return {
    name: "postcss-plugin",
    async setup(build) {
      postcssCompiler =
        postcssCompiler ||
        getPostcssCompiler({
          postcssProcessor,
          sourcemap: options.sourcemap,
        });

      build.onLoad({ filter: /\.css$/, namespace: "file" }, async (args) => {
        let contents = await postcssCompiler.processFile(args.path);

        return {
          contents,
          loader: "css",
        };
      });
    },
  };
}
