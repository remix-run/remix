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

export interface CssModulesRef {
  current: {
    filePath?: string | undefined;
    content: string;
  };
}

type CSSModuleClassMap = Record<string, string>;

const suffixMatcher = /\.module\.css?$/;

/**
 * Loads *.module.css files on the server build and returns the hashed JSON so
 * we can get the right classnames in the HTML.
 */
export function serverCssModulesPlugin(config: RemixConfig): esbuild.Plugin {
  return {
    name: "server-css-modules",
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, (args) => {
        return {
          path: getResolvedFilePath(config, args),
          namespace: "server-css-modules",
        };
      });

      build.onLoad({ filter: suffixMatcher }, async (args) => {
        try {
          let { json } = await processCssCached(config, args.path);

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
 * Loads *.module.css files in the browser build and calls back with the
 * processed CSS so it can be compiled into a single global file.
 */
export function browserCssModulesPlugin(
  config: RemixConfig,
  handleProcessedCss: (css: string) => void
): esbuild.Plugin {
  return {
    name: "browser-css-modules",
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, (args) => {
        return {
          path: getResolvedFilePath(config, args),
          namespace: "browser-css-modules",
          // It's safe to remove this import if the classnames aren't used anywhere.
          sideEffects: false,
        };
      });

      build.onLoad({ filter: suffixMatcher }, async (args) => {
        try {
          let { css, json } = await processCssCached(config, args.path);

          handleProcessedCss(css);

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

interface ProcessedCSS {
  css: string;
  json: CSSModuleClassMap;
}

let memoryCssCache = new Map<
  string,
  { hash: string; processedCssPromise: Promise<ProcessedCSS> }
>();

async function processCssCached(
  config: RemixConfig,
  filePath: string
): Promise<ProcessedCSS> {
  let file = path.resolve(config.appDirectory, filePath);
  let hash = await getFileHash(file);

  // Use an in-memory cache to prevent browser + server builds from compiling
  // the same CSS at the same time. They can re-use each other's work!
  let cached = memoryCssCache.get(file);
  if (cached) {
    if (cached.hash === hash) {
      return cached.processedCssPromise;
    } else {
      // Contents of the file changed, get it out of the in-memory cache.
      memoryCssCache.delete(file);
    }
  }

  // Use an on-disk cache to speed up dev server boot.
  let processedCssPromise = (async function () {
    let key = file + ".cssmodule";

    let cached: (ProcessedCSS & { hash: string }) | null = null;
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

  memoryCssCache.set(file, { hash, processedCssPromise });

  return processedCssPromise;
}

async function processCss(file: string) {
  let json: CSSModuleClassMap = {};

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
  // if possible.
  return args.path.startsWith("~/")
    ? path.resolve(config.appDirectory, args.path.replace(/^~\//, ""))
    : path.resolve(args.resolveDir, args.path);
}

/**
 * Creates a virtual module called `@remix-run/dev/css-modules` that exports the
 * URL of the compiled CSS that users will use in their route's `link` export.
 */
export function serverCssModulesModulePlugin(
  assetsManifestPromiseRef: AssetsManifestPromiseRef
): esbuild.Plugin {
  let filter = cssModulesVirtualModule.filter;
  return {
    name: "css-modules-module",
    setup(build) {
      build.onResolve({ filter }, async () => {
        let filePath = (await assetsManifestPromiseRef.current)?.cssModules;
        return {
          path: filePath,
          namespace: "server-css-modules-module",
        };
      });

      build.onLoad({ filter }, async (args) => {
        return {
          resolveDir: args.path,
          loader: "css",
        };
      });
    },
  };
}

export function browserCssModulesModulePlugin(
  cssModulesFilePath: string | undefined
): esbuild.Plugin {
  let filter = cssModulesVirtualModule.filter;
  return {
    name: "css-modules-module",
    setup(build) {
      build.onResolve({ filter }, async () => {
        return {
          path: cssModulesFilePath,
          namespace: "browser-css-modules-module",
        };
      });

      build.onLoad({ filter }, async (args) => {
        return {
          resolveDir: args.path,
          loader: "css",
        };
      });
    },
  };
}
