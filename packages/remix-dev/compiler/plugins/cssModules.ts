import postcss from "postcss";
import type { Result as PostCSSResult } from "postcss";
import cssModules from "postcss-modules";
import path from "path";
import * as fse from "fs-extra";
import type * as esbuild from "esbuild";

import { getFileHash } from "../utils/crypto";
import * as cache from "../../cache";
import type { RemixConfig } from "../../config";

type CSSModuleClassMap = { [key: string]: string };

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
  let result = await postcss([
    cssModules({
      localsConvention: "camelCase",
      generateScopedName: "[name]__[local]___[hash:base64:8]",
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
  return { css: result.css, json };
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
