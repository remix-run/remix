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
    { css, sourceMap, json }: CssModuleFileContents
  ) => void
): esbuild.Plugin {
  return {
    name: "css-modules",
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, async (args) => {
        try {
          if (!parcelTransform) {
            parcelTransform = (await import("@parcel/css")).default.transform;
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
        } catch (err) {
          console.error(`
--------------------------------------------------------------------------------

A CSS Modules file was imported, but the required \`@remix-run/css-modules\`
dependency was not found.

Install the dependency by running the following command, then restart your app.

    npm install @remix-run/css-modules

--------------------------------------------------------------------------------
`);
          throw err;
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
          let processed = await processCssCached(config, args.path);
          handleProcessedCss(args.path, processed);
          return {
            contents: JSON.stringify(processed.json),
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
      let processed = await processCss(config, filePath);
      cached = { hash, ...processed };
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

async function processCss(
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
    analyzeDependencies: true,
    sourceMap: true,
    drafts: { nesting: true },
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

  return {
    css,
    json,
    sourceMap,
    moduleExports: res.exports || {},
    dependencies: res.dependencies || [],
  };
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
 * but that will require us to juggle dependencies which is a little tricky with
 * the current build since we don't know for sure if that dependency has been
 * processed yet. Coming back to this.
 */
function getComposedClassNames(name: string, composes: CssModuleReference[]) {
  return composes.reduce((prev, cur) => {
    // skip dependencies for now
    if (cur.type === "dependency") return prev;
    return prev + " " + cur.name;
  }, name);
}

export interface CssModuleFileContents {
  css: string;
  sourceMap: string | null;
  json: CssModuleClassMap;
  moduleExports: CssModuleExports;
  dependencies: CssModuleDependency[];
}

export type CssModuleFileMap = Record<string, CssModuleFileContents>;

export interface CssModulesResults {
  globalStylesheetFilePath: string;
  globalStylesheetFileUrl: string;
  moduleMap: CssModuleFileMap;
}

export type CssModuleClassMap = Record<string, string>;

// Copy/pasted some types from @parcel/css to avoid dependency issues
interface ParcelTransformOptions {
  filename: string;
  code: Buffer;
  minify?: boolean;
  sourceMap?: boolean;
  cssModules?: boolean;
  drafts?: { [key: string]: boolean };
  analyzeDependencies?: boolean;
  unusedSymbols?: string[];
}

interface ParcelTransformResult {
  code: Buffer;
  map: Buffer | void;
  exports: CssModuleExports | void;
  dependencies: CssModuleDependency[] | void;
}

/**
 * Many of these types were copied from @parcel/css and modified slightly for
 * our needs. Some of this data will end up in the assets manifest but we don't
 * want more than we need.
 */

type CssModuleExports = {
  [name: string]: CssModuleExport;
};

interface CssModuleExport {
  name: string;
  composes: CssModuleReference[];
}

type CssModuleReference =
  | LocalCssModuleReference
  | GlobalCssModuleReference
  | DependencyCssModuleReference;

interface LocalCssModuleReference {
  type: "local";
  name: string;
}

interface GlobalCssModuleReference {
  type: "global";
  name: string;
}

interface DependencyCssModuleReference {
  type: "dependency";
  name: string;
  /** The dependency specifier for the referenced file. */
  specifier: string;
}

type CssModuleDependency = CssModuleImportDependency | CssModuleUrlDependency;

interface CssModuleImportDependency {
  type: "import";
  /** The url of the `@import` dependency. */
  url: string;
  /** The media query for the `@import` rule. */
  media: string | null;
  /** The `supports()` query for the `@import` rule. */
  supports: string | null;
  /** The source location where the `@import` rule was found. */
  loc: CssModuleSourceLocation;
}

interface CssModuleUrlDependency {
  type: "url";
  /** The url of the dependency. */
  url: string;
  /** The source location where the `url()` was found. */
  loc: CssModuleSourceLocation;
  /** The placeholder that the url was replaced with. */
  placeholder: string;
}

interface CssModuleSourceLocation {
  /** The file path in which the dependency exists. */
  filePath: string;
  /** The start location of the dependency. */
  start: {
    line: number;
    column: number;
  };
  /** The end location (inclusive) of the dependency. */
  end: {
    line: number;
    column: number;
  };
}
