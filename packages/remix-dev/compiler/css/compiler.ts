import { builtinModules as nodeBuiltins } from "node:module";
import { relative, sep, posix } from "node:path";
import * as esbuild from "esbuild";
import cloneDeep from "lodash/cloneDeep";

import { loaders } from "../utils/loaders";
import { cssFilePlugin } from "../plugins/cssImports";
import { absoluteCssUrlsPlugin } from "../plugins/absoluteCssUrlsPlugin";
import { emptyModulesPlugin } from "../plugins/emptyModules";
import { mdxPlugin } from "../plugins/mdx";
import { externalPlugin } from "../plugins/external";
import { cssModulesPlugin } from "../plugins/cssModuleImports";
import { cssSideEffectImportsPlugin } from "../plugins/cssSideEffectImports";
import { vanillaExtractPlugin } from "../plugins/vanillaExtract";
import {
  cssBundleEntryModulePlugin,
  cssBundleEntryModuleId,
} from "./plugins/bundleEntry";
import type { Context } from "../context";
import { getCssBundleFiles } from "./bundle";
import { writeMetafile } from "../analysis";

// This allows us to collect all input CSS files in the 1st CSS bundle build. We
// need to store this info so that we can reference it when tree shaking in a
// 2nd build that only imports CSS files referenced by the JS output. We need to
// do this because esbuild doesn't tree shake CSS as of esbuild 0.17.7.
type CollectedCss = Record<string, { contents: string; resolveDir: string }>;
let collectedCss: CollectedCss;
function collectCss({
  namespace,
  path,
  resolveDir,
  contents,
}: {
  namespace: string;
  path: string;
  resolveDir: string;
  contents: string;
}) {
  let key = `${namespace}:${path}`;
  collectedCss[key] = { contents, resolveDir };
}

function getMetafilePath(ctx: Context, path: string): string {
  return relative(ctx.config.rootDirectory, path).split(sep).join(posix.sep);
}

const createEsbuildConfig = (ctx: Context): esbuild.BuildOptions => {
  return {
    entryPoints: { "css-bundle": cssBundleEntryModuleId },
    outdir: ctx.config.assetsBuildDirectory,
    platform: "browser",
    format: "esm",
    // Node built-ins (and any polyfills) are guaranteed to never contain CSS,
    // and the JS from this build will never be executed, so we can safely skip
    // bundling them and leave any imports of them as-is in the generated JS.
    // Any issues with Node built-ins will be caught by the browser JS build.
    external: nodeBuiltins,
    loader: loaders,
    bundle: true,
    logLevel: "silent",
    sourcemap: ctx.options.sourcemap,
    // As pointed out by https://github.com/evanw/esbuild/issues/2440, when tsconfig is set to
    // `undefined`, esbuild will keep looking for a tsconfig.json recursively up. This unwanted
    // behavior can only be avoided by creating an empty tsconfig file in the root directory.
    tsconfig: ctx.config.tsconfigPath,
    mainFields: ["browser", "module", "main"],
    treeShaking: true,
    // Minification is handled later during the tree-shaking build
    minify: false,
    entryNames: "[dir]/[name]-[hash]",
    chunkNames: "_shared/[name]-[hash]",
    assetNames: "_assets/[name]-[hash]",
    publicPath: ctx.config.publicPath,
    define: {
      "process.env.NODE_ENV": JSON.stringify(ctx.options.mode),
    },
    jsx: "automatic",
    jsxDev: ctx.options.mode !== "production",
    plugins: [
      cssBundleEntryModulePlugin(ctx),

      // IMPORTANT: We pass the "collectCss" function to all CSS bundler plugins
      // so the output CSS can be referenced later during the tree-shaking build
      cssModulesPlugin(ctx, { outputCss: true, collectCss }),
      vanillaExtractPlugin(ctx, { outputCss: true, collectCss }),
      cssSideEffectImportsPlugin(ctx, { collectCss }),

      cssFilePlugin(ctx),
      absoluteCssUrlsPlugin(),
      externalPlugin(/^https?:\/\//, { sideEffects: false }),
      mdxPlugin(ctx),
      // Skip compilation of common packages/scopes known not to include CSS imports
      emptyModulesPlugin(ctx, /^(@remix-run|react|react-dom)(\/.*)?$/, {
        includeNodeModules: true,
      }),
      emptyModulesPlugin(ctx, /\.server(\.[jt]sx?)?$/),
      externalPlugin(/^node:.*/, { sideEffects: false }),
    ],
    supported: {
      "import-meta": true,
    },
  };
};

const createCssTreeShakerEsbuildConfig = (
  ctx: Context,
  collectedCss: CollectedCss,
  cssKeys: string[]
): esbuild.BuildOptions => {
  let cssTreeShakerEntryId = "::css-tree-shaker-entry";
  let cssTreeShakerEntryFilter = new RegExp(`^${cssTreeShakerEntryId}$`);

  return {
    entryPoints: { "css-bundle": cssTreeShakerEntryId },
    outdir: ctx.config.assetsBuildDirectory,
    platform: "browser",
    format: "esm",
    loader: loaders,
    bundle: true,
    logLevel: "silent",
    sourcemap: ctx.options.sourcemap,
    // As pointed out by https://github.com/evanw/esbuild/issues/2440, when tsconfig is set to
    // `undefined`, esbuild will keep looking for a tsconfig.json recursively up. This unwanted
    // behavior can only be avoided by creating an empty tsconfig file in the root directory.
    tsconfig: ctx.config.tsconfigPath,
    mainFields: ["browser", "module", "main"],
    treeShaking: true,
    minify: ctx.options.mode === "production",
    entryNames: "[dir]/[name]-[hash]",
    chunkNames: "_shared/[name]-[hash]",
    assetNames: "_assets/[name]-[hash]",
    publicPath: ctx.config.publicPath,
    plugins: [
      {
        name: "css-tree-shaker-plugin",
        setup(build) {
          build.onResolve({ filter: cssTreeShakerEntryFilter }, ({ path }) => {
            return { path, namespace: "css" };
          });

          // Create a virtual entry point that imports all non tree-shaken CSS
          // files in order
          build.onLoad({ filter: cssTreeShakerEntryFilter }, async () => {
            return {
              loader: "js",
              contents: cssKeys
                .map((key) => `import ${JSON.stringify(key)}`)
                .join("\n"),
            };
          });

          // Process all imports from the virtual entry point
          build.onResolve({ filter: /.*$/ }, ({ path, importer }) => {
            if (importer === cssTreeShakerEntryId) {
              return { path, namespace: "css" };
            }
          });

          build.onLoad({ filter: /.*/, namespace: "css" }, async ({ path }) => {
            let css = collectedCss[path];
            if (!css) {
              throw new Error(`Could not find CSS for ${JSON.stringify(path)}`);
            }
            return {
              loader: "css",
              resolveDir: css.resolveDir,
              contents: css.contents,
            };
          });
        },
      },
      absoluteCssUrlsPlugin(),
      externalPlugin(/^https?:\/\//, { sideEffects: false }),
    ],
  };
};

export let create = async (ctx: Context) => {
  let compiler = await esbuild.context({
    ...createEsbuildConfig(ctx),
    write: false,
    metafile: true,
    minify: false,
  });
  let compile = async () => {
    // Reset the collected CSS for this build
    collectedCss = {};

    let sourceBuild = await compiler.rebuild();

    // Take a snapshot of the collected CSS so it's stable for the 2nd build
    let collectedCssSnapshot = cloneDeep(collectedCss);

    let cssBundleFiles = getCssBundleFiles(ctx, sourceBuild.outputFiles);

    // If this build didn't generate any CSS, we can skip the 2nd build.
    if (!cssBundleFiles.css) {
      return {
        bundleOutputFile: undefined,
        outputFiles: [],
      };
    }

    // Get the names of the files that were inputs to the JS file from the CSS
    // bundle build. This allows us to check whether a CSS file was referenced
    // by a JS file after tree-shaking has occurred.
    let jsPath = getMetafilePath(ctx, cssBundleFiles.js.path);
    let jsInputs = sourceBuild.metafile.outputs[jsPath].inputs;

    // Get the names of the CSS files that were inputs to the CSS bundle. This
    // allows us to get a sorted list of all bundled CSS files which we can then
    // use to generate the virtual entry point for a 2nd CSS bundle build that
    // only includes the CSS files that weren't tree-shaken.
    let cssPath = getMetafilePath(ctx, cssBundleFiles.css.path);
    let cssInputs = sourceBuild.metafile.outputs[cssPath].inputs;

    // Only include CSS files that are referenced in the final JS build. If a
    // JS file is tree-shaken, it won't be present in "jsInputs".
    let cssKeys = Object.keys(cssInputs).filter((key) => key in jsInputs);

    // Create a new build that only includes the CSS files that were referenced
    // in the final JS output. We provide a virtual entry point that imports all
    // CSS files in the order returned by esbuild in our 1st build.
    let { outputFiles, metafile } = await esbuild.build({
      ...createCssTreeShakerEsbuildConfig(ctx, collectedCssSnapshot, cssKeys),
      write: false,
      metafile: true,
    });

    writeMetafile(ctx, "metafile.css.json", metafile);

    return {
      bundleOutputFile: getCssBundleFiles(ctx, outputFiles).css,
      outputFiles,
    };
  };
  return {
    compile,
    cancel: compiler.cancel,
    dispose: compiler.dispose,
  };
};
