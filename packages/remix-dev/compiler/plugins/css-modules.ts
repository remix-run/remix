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
interface CachedCSSResult {
  hash: string;
  result: PostCSSResult;
  json: CSSModuleClassMap;
}

const suffixMatcher = /\.module\.css?$/;

export function cssModulesServerPlugin(config: RemixConfig): esbuild.Plugin {
  return {
    name: "css-modules-imports-server",
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, (args) => {
        return {
          path: getResolvedFilePath(config, args),
          namespace: "css-modules-import-server",
        };
      });

      build.onLoad({ filter: suffixMatcher }, async (args) => {
        try {
          if (config.unstable_cssModules !== true) {
            throw Error(
              "CSS Module imports are an experimental feature and not supported by " +
                "default. To enable support for CSS Modules, set `unstable_cssModules` " +
                "to `true` in `remix.config.js`."
            );
          }
          let { json } = await processCss(config, args.path);
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

export function cssModulesClientPlugin(
  config: RemixConfig,
  handleProcessedCss: (args: { css: string; hash: string }) => void
): esbuild.Plugin {
  return {
    name: "css-modules-imports-client",
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, (args) => {
        return {
          path: getResolvedFilePath(config, args),
          namespace: "css-modules-import-client",
          sideEffects: false,
        };
      });

      build.onLoad({ filter: suffixMatcher }, async (args) => {
        try {
          if (config.unstable_cssModules !== true) {
            throw Error(
              "CSS Module imports are an experimental feature and not supported by " +
                "default. To enable support for CSS Modules, set `unstable_cssModules` " +
                "to `true` in `remix.config.js`."
            );
          }
          let { json, result, hash } = await processCss(config, args.path);
          handleProcessedCss({ css: result.css, hash });
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

let cssPromiseCache = new Map<string, Promise<any>>();

async function processCss(
  config: RemixConfig,
  filePath: string
): Promise<CachedCSSResult> {
  let hash = (await getFileHash(filePath)).slice(0, 8).toUpperCase();
  if (cssPromiseCache.has(hash)) {
    return cssPromiseCache.get(hash);
  }

  let cssPromise = (async function () {
    let cached: CachedCSSResult | null = null;
    let key = getCacheKey(config, filePath);
    let json: CSSModuleClassMap = {};
    try {
      cached = await cache.getJson(config.cacheDirectory, key);
    } catch (error) {}

    if (!cached || cached.hash !== hash) {
      let css = await fse.readFile(filePath, "utf-8");
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
      ]).process(css, { from: undefined, map: false });
      cached = { hash, json, result };

      try {
        await cache.putJson(config.cacheDirectory, key, cached);
      } catch (error) {}
    }
    return cached;
  })();
  cssPromiseCache.set(hash, cssPromise);
  return cssPromise;
}

function getCacheKey(config: RemixConfig, filePath: string) {
  return "css-module:" + path.relative(config.appDirectory, filePath);
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
