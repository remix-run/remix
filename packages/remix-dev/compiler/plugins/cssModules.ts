import postcss from "postcss";
import cssModules from "postcss-modules";
import path from "path";
import chalk from "chalk";
import * as fse from "fs-extra";
import type * as esbuild from "esbuild";

import { getFileHash, getHash } from "../utils/crypto";
import * as cache from "../../cache";
import type { RemixConfig } from "../../config";
import { resolveUrl } from "../utils/url";
import type { AssetsManifestPromiseRef } from "./serverAssetsManifestPlugin";

const suffixMatcher = /\.module\.css?$/;

// TODO: Remove when finished comparing Parcel + PostCSS
const USE_PARCEL = true;

let parcelTransform: (opts: ParcelTransformOptions) => ParcelTransformResult;
const decoder = new TextDecoder();

/**
 * Loads *.module.css files and returns the hashed JSON so we can get the right
 * classnames in the HTML.
 */
export function cssModulesPlugin(
  config: RemixConfig,
  handleProcessedCss: (
    filePath: string,
    css: string,
    sourceMap: string | null,
    json: CssModuleClassMap
  ) => void
): esbuild.Plugin {
  return {
    name: "css-modules",
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, async (args) => {
        if (USE_PARCEL) {
          try {
            if (!parcelTransform) {
              parcelTransform = (await import("@parcel/css")).default.transform;
              console.log({ parcelTransform });
              console.warn(
                chalk.yellow(`
--------------------------------------------------------------------------------

CSS Modules support in Remix is experimental. It's implementation may change.
If you find a bug, please report it by opening an issue on GitHub:

https://github.com/remix-run/remix/issues/new?labels=bug&template=bug_report.yml

--------------------------------------------------------------------------------
`)
              );
            }
          } catch (_) {
            throw _;
            //           throw Error(
            //             `A CSS Modules file was imported, but the required \`@remix-run/css-modules\` dependency was not found.

            // Install the dependency by running the following command and restart your app.

            // npm install @remix-run/css-modules`
            //           );
          }
        }

        let path = getResolvedFilePath(config, args);
        return {
          path,
          namespace: "css-modules",
          sideEffects: false,
        };
      });

      build.onLoad({ filter: suffixMatcher }, async (args) => {
        try {
          let { css, json, sourceMap } = await processCssCached(
            config,
            args.path
          );
          handleProcessedCss(args.path, css, sourceMap, json);
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
  assetsManifestPromiseRef: AssetsManifestPromiseRef
): esbuild.Plugin {
  return {
    name: "css-modules-faker",
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, (args) => {
        return {
          path: getResolvedFilePath(config, args),
          namespace: "css-modules-faker",
          sideEffects: false,
        };
      });

      build.onLoad({ filter: suffixMatcher }, async (args) => {
        let res = await assetsManifestPromiseRef.current;
        let json = res?.cssModules?.moduleMap[args.path].json || {};
        return {
          contents: JSON.stringify(json),
          loader: "json",
        };
      });
    },
  };
}

export function serverCssModulesStylesheetPlugin(): esbuild.Plugin {
  let filter = /^@remix-run\/css-modules$/;
  return {
    name: "server-css-modules-stylesheet",
    async setup(build) {
      build.onResolve({ filter }, ({ path }) => {
        return {
          path: path + "/server",
          namespace: "server-css-modules-stylesheet",
        };
      });
    },
  };
}

export function browserCssModulesStylesheetPlugin(): esbuild.Plugin {
  let filter = /^@remix-run\/css-modules$/;
  return {
    name: "browser-css-modules-stylesheet",
    async setup(build) {
      build.onResolve({ filter }, ({ path }) => {
        return {
          path: path + "/browser",
          namespace: "browser-css-modules-stylesheet",
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
      let { css, json, sourceMap } = await processCss(config, filePath);
      cached = { hash, css, json, sourceMap };

      try {
        await cache.putJson(config.cacheDirectory, key, cached);
      } catch (error) {
        // Ignore cache put errors.
      }
    }

    return cached;
  })();

  return processedCssPromise;
}

async function processCssWithPostCss(
  file: string
): Promise<CssModuleFileContents> {
  let json: CssModuleClassMap = {};
  let source = await fse.readFile(file, "utf-8");
  let { css, map: mapRaw } = await postcss([
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
    map: true,
  });

  let sourceMap = mapRaw ? mapRaw.toString() : null;
  return { css, json, sourceMap };
}

async function processCssWithParcel(
  config: RemixConfig,
  file: string
): Promise<CssModuleFileContents> {
  let json: CssModuleClassMap = {};
  let source = await fse.readFile(file);

  let res = parcelTransform({
    filename: path.relative(config.appDirectory, file),
    code: source,
    cssModules: true,
    minify: process.env.NODE_ENV === "production",
    // Users will not be able to @import other stylesheets in modules with this
    // limitation, nor can you compose classes from outside stylesheets as we'd
    // have to decide where and how we want to handle duplicate dependencies in
    // various stylesheets. This is not a feature in CSS Modules specifically,
    // but other frameworks may support it. We might want to do more research
    // here, but in the mean time any dependencies should be imported as a
    // separate global stylesheet and loaded before the CSS Modules stylesheet.
    analyzeDependencies: true,
    sourceMap: true,
    drafts: {
      nesting: true,
    },
  });

  let parcelExports = res.exports || {};
  for (let key in parcelExports) {
    let props = parcelExports[key];
    json = {
      ...json,
      [key]: props.composes.length
        ? getComposedClassNames(props.name, props.composes)
        : props.name,
    };
  }
  let css = decoder.decode(res.code);
  let sourceMap = res.map ? decoder.decode(res.map) : null;

  return { css, json, sourceMap };
}

async function processCss(
  config: RemixConfig,
  file: string
): Promise<CssModuleFileContents> {
  return await (USE_PARCEL
    ? processCssWithParcel(config, file)
    : processCssWithPostCss(file));
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

export function getCssModulesFileReferences(
  config: RemixConfig,
  css: string
): [globalStylesheetFilePath: string, globalStylesheetFileUrl: string] {
  let hash = getHash(css).slice(0, 8).toUpperCase();
  let filePath = path.resolve(
    config.assetsBuildDirectory,
    "_assets",
    `__css-modules-${hash}.css`
  );
  let fileUrl = resolveUrl(config, filePath);
  return [filePath, fileUrl];
}

/**
 * When a user composes classnames in CSS modules, the value returned for the
 * JSON map is a concat'd version of all the classname strings composed. Note
 * that the user may compose classnames referenced in other CSS module files,
 * but that will require us to juggle dependencies and we're not quite ready for
 * that yet. Will revisit that later.
 */
function getComposedClassNames(name: string, composes: ParcelComposeData[]) {
  return composes.reduce((prev, cur) => {
    // skip dependencies for now
    if (cur.type === "dependency") return prev;
    return prev + " " + cur.name;
  }, name);
}

export interface CssModuleFileContents {
  css: string;
  json: CssModuleClassMap;
  sourceMap: string | null;
}

export type CssModuleFileMap = Record<string, CssModuleFileContents>;

export interface CssModulesResults {
  globalStylesheetFilePath: string;
  globalStylesheetFileUrl: string;
  moduleMap: CssModuleFileMap;
}

export type CssModuleClassMap = Record<string, string>;

// Copy/pasted some types to avoid imports since we're doing that dynamically
interface ParcelTransformOptions {
  filename: string;
  code: Buffer;
  minify?: boolean;
  sourceMap?: boolean;
  targets?: ParcelTargets;
  cssModules?: boolean;
  drafts?: { [key: string]: boolean };
  analyzeDependencies?: boolean;
  unusedSymbols?: string[];
}

interface ParcelTargets {
  android?: number;
  chrome?: number;
  edge?: number;
  firefox?: number;
  ie?: number;
  ios_saf?: number;
  opera?: number;
  safari?: number;
  samsung?: number;
}

interface ParcelTransformResult {
  code: Buffer;
  map: Buffer | void;
  exports: ParcelCSSModuleExports | void;
  dependencies: any[] | void;
}

type ParcelCSSModuleExports = {
  [name: string]: ParcelCSSModuleExport;
};

interface ParcelCSSModuleExport {
  name: string;
  isReferenced: boolean;
  composes: ParcelComposeData[];
}

interface ParcelComposeData {
  type: "local" | "global" | "dependency";
  name: string;
}

interface ParcelComposeData {
  type: "local" | "global" | "dependency";
  name: string;
}
