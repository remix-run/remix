import postcss from "postcss";
import cssModules from "postcss-modules";
import path from "path";
import * as fse from "fs-extra";
import type * as esbuild from "esbuild";

import { getFileHash } from "../utils/crypto";
import * as cache from "../../cache";
import type { RemixConfig } from "../../config";
import { cssModulesVirtualModule } from "../virtualModules";
import type { AssetsManifestPromiseRef } from "./serverAssetsManifestPlugin";
import type { CssModulesBuild } from "../../compiler";

const suffixMatcher = /\.module\.css?$/;

/**
 * Loads *.module.css files and returns the hashed JSON so we can get the right
 * classnames in the HTML.
 */
export function cssModulesPlugin(
  config: RemixConfig,
  handleProcessedCss: (
    filePath: string,
    css: string,
    json: CssModuleClassMap
  ) => void
): esbuild.Plugin {
  return {
    name: "css-modules",
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, (args) => {
        return {
          path: getResolvedFilePath(config, args),
          namespace: "css-modules",
          sideEffects: false,
        };
      });

      build.onLoad({ filter: suffixMatcher }, async (args) => {
        try {
          let { css, json } = await processCssCached(config, args.path);
          handleProcessedCss(args.path, css, json);
          return {
            contents: JSON.stringify(json),
            loader: "json",
          };
        } catch (err: any) {
          return {
            errors: [{ text: err.message }],
          };
        }
      });
    },
  };
}

/**
 * This plugin is for the browser + server builds. It doesn't actually process
 * the CSS, but it resolves the import paths and yields to the CSS Modules build
 * for the results.
 */
export function cssModulesFakerPlugin(
  config: RemixConfig,
  cssModulesBuildPromiseRef: CssModulesBuildPromiseRef
): esbuild.Plugin {
  return {
    name: "css-modules-faker",
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, (args) => {
        return {
          path: getResolvedFilePath(config, args),
          namespace: "css-modules",
          sideEffects: false,
        };
      });

      build.onLoad({ filter: suffixMatcher }, async (args) => {
        let res = await cssModulesBuildPromiseRef.current!;
        let { json } = res.moduleMap[args.path];
        return {
          contents: JSON.stringify(json),
          loader: "json",
        };
      });
    },
  };
}

/**
 * Creates a virtual module called `@remix-run/dev/css-modules` that exports the
 * URL of the compiled CSS that users will use in their route's `link` export.
 */
export function cssModulesVirtualModulePlugin(
  assetsManifestPromiseRef: AssetsManifestPromiseRef
): esbuild.Plugin {
  let filter = cssModulesVirtualModule.filter;
  return {
    name: "css-modules-virtual-module",
    setup(build) {
      build.onResolve({ filter }, async ({ path }) => {
        return {
          path,
          namespace: "css-modules-virtual-module",
        };
      });

      build.onLoad({ filter }, async () => {
        let fileUrl = (await assetsManifestPromiseRef.current)?.cssModules
          ?.fileUrl;

        return {
          loader: "js",
          contents: `export default ${
            fileUrl
              ? `"${fileUrl}"`
              : // If there is no CSS module file the import should return undefined.
                // Users should check for a value and conditionally render a
                // link only if we have modules. This way we can avoid annoying
                // errors if they delete any references to CSS modules, though
                // perhaps a dev warning would be helpful if they intended to
                // remove CSS modules but left the virtual module import!
                "undefined"
          }`,
        };
      });
    },
  };
}

async function processCssCached(
  config: RemixConfig,
  filePath: string
): Promise<CssModuleFileContents> {
  let file = path.resolve(config.appDirectory, filePath);
  let hash = await getFileHash(file);

  // Use an on-disk cache to speed up dev server boot.
  let processedCssPromise = (async function () {
    let key = file + ".cssmodule";

    let cached: (CssModuleFileContents & { hash: string }) | null = null;
    try {
      cached = await cache.getJson(config.cacheDirectory, key);
    } catch (error) {
      // Ignore cache read errors.
    }

    if (!cached || cached.hash !== hash) {
      let { css, json } = await processCss(filePath);
      cached = { hash, css, json };

      try {
        await cache.putJson(config.cacheDirectory, key, cached);
      } catch (error) {
        // Ignore cache put errors.
      }
    }

    return {
      css: cached.css,
      json: cached.json,
    };
  })();

  return processedCssPromise;
}

async function processCss(file: string) {
  let json: CssModuleClassMap = {};
  let source = await fse.readFile(file, "utf-8");
  let { css } = await postcss([
    cssModules({
      localsConvention: "camelCase",
      // [name]  -> CSS modules file-name (button.module.css -> button-module)
      // [local] -> locally assigned classname
      // example:
      //   in button.module.css: .button {}
      //   generated classname:  .button-module__button_wtIDeq {}
      generateScopedName: "[name]__[local]_[hash:base64:8]",
      hashPrefix: "remix",
      getJSON(_, data) {
        json = { ...data };
        return json;
      },
    }),
  ]).process(source, {
    from: undefined,
    map: false,
  });

  // TODO: Support sourcemaps when using .module.css files
  return { css, json };
}

function getResolvedFilePath(
  config: RemixConfig,
  args: { path: string; resolveDir: string }
) {
  // TODO: Ideally we should deal with the "~/" higher up in the build process
  // if possible. Also ... what if the user changes this alias in their
  // tsconfig? Do we support that?
  return args.path.startsWith("~/")
    ? path.resolve(config.appDirectory, args.path.replace(/^~\//, ""))
    : path.resolve(args.resolveDir, args.path);
}

export async function getCssModulesFilePath(config: RemixConfig, css: string) {
  let hash = (await getFileHash(css)).slice(0, 8).toUpperCase();
  return path.relative(
    config.assetsBuildDirectory,
    path.resolve(`__css-modules-${hash}.css`)
  );
}

export interface CssModulesBuildPromiseRef {
  current?: Promise<CssModulesBuild>;
}

export interface CssModuleFileContents {
  css: string;
  json: CssModuleClassMap;
}

export type CssModuleFileMap = Record<string, CssModuleFileContents>;

export interface CssModulesResults {
  filePath: string;
  moduleMap: CssModuleFileMap;
}

export type CssModuleClassMap = Record<string, string>;
