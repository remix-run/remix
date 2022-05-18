import path from "path";
import * as fse from "fs-extra";
import chalk from "chalk";
import type * as esbuild from "esbuild";

import { getHash } from "../utils/crypto";
import type { RemixConfig } from "../../config";
import { resolveUrl } from "../utils/url";
import { createMatchPath } from "../utils/tsconfig";
import type { AssetsManifestPromiseRef } from "./serverAssetsManifestPlugin";

const browserPluginName = "css-modules";
const browserPluginNamespace = `${browserPluginName}-namespace`;
const serverPluginName = "css-modules-server";
const serverPluginNamespace = `${serverPluginName}-namespace`;
const suffixMatcher = /\.modules?\.css$/;

let parcelTransform: (opts: ParcelTransformOptions) => ParcelTransformResult;
const decoder = new TextDecoder();

/**
 * Loads *.module.css files and returns the hashed JSON so we can get the right
 * classnames in the HTML.
 */
export function cssModulesBrowserPlugin(config: RemixConfig): esbuild.Plugin {
  return {
    name: browserPluginName,
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, async (args) => {
        try {
          if (!parcelTransform) {
            parcelTransform = (await import("@parcel/css")).default.transform;
            console.warn(
              chalk.yellow(`
--------------------------------------------------------------------------------

CSS Modules support in Remix is experimental. Its implementation may change.
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

        let path = getResolvedFilePath(args);
        return {
          pluginName: browserPluginName,
          namespace: browserPluginNamespace,
          path,
          sideEffects: false,
        };
      });

      build.onLoad(
        { filter: suffixMatcher, namespace: browserPluginNamespace },
        async (args) => {
          try {
            let processed = await processCss({
              config,
              filePath: args.path,
            });
            let json = processed?.json || {};
            return {
              contents: JSON.stringify(json),
              loader: "json",
            };
          } catch (err: any) {
            return {
              errors: [{ text: err.message }],
            };
          }
        }
      );
    },
  };
}

/**
 * This plugin is for the server build. It doesn't actually process the CSS, but
 * it  and waits for the assets manifest to resolve module imports.
 */
export function cssModulesServerPlugin(
  config: RemixConfig,
  assetsManifestPromiseRef: AssetsManifestPromiseRef
): esbuild.Plugin {
  return {
    name: serverPluginName,
    async setup(build) {
      build.onResolve({ filter: suffixMatcher }, (args) => {
        return {
          pluginName: serverPluginName,
          namespace: serverPluginNamespace,
          path: getResolvedFilePath(args),
          sideEffects: false,
        };
      });

      build.onLoad(
        { filter: suffixMatcher, namespace: serverPluginNamespace },
        async (args) => {
          let res = await assetsManifestPromiseRef.current;
          let json = res?.cssModules?.moduleMap[args.path]?.json || {};
          return {
            contents: JSON.stringify(json),
            loader: "json",
          };
        }
      );
    },
  };
}

export async function processCss({
  config,
  filePath,
}: {
  config: RemixConfig;
  filePath: string;
}): Promise<CssModuleFileContents> {
  let classPrefix =
    path.basename(filePath, path.extname(filePath)).replace(/\./g, "-") + "__";
  let source = await fse.readFile(filePath);

  let res = parcelTransform({
    filename: path.relative(config.appDirectory, filePath),
    code: source,
    cssModules: true,
    minify: process.env.NODE_ENV === "production",
    analyzeDependencies: true,
    sourceMap: true,
    drafts: { nesting: true },
  });

  let json: CssModuleClassMap = {};
  let cssModulesContent = decoder.decode(res.code);
  let parcelExports = res.exports || {};

  // sort() to keep order consistent in different builds
  for (let originClass of Object.keys(parcelExports).sort()) {
    let props = parcelExports[originClass];
    let patchedClass = props.name;
    let prefixedClassName = getPrefixedClassName(classPrefix, patchedClass);
    json[originClass] = props.composes.length
      ? getComposedClassNames(classPrefix, prefixedClassName, props.composes)
      : prefixedClassName;
    cssModulesContent = cssModulesContent.replace(
      new RegExp(`\\.${patchedClass}`, "g"),
      "." + prefixedClassName
    );
  }

  let cssWithSourceMap = cssModulesContent;
  if (res.map) {
    // TODO: Sourcemaps aren't working as expected because we are inlining the
    // map at the end of each module. We need to merge them into a single
    // inline sourcemap at the end of the build. We can probably use something
    // like https://www.npmjs.com/package/merge-source-maps
    // cssWithSourceMap += `\n/*# sourceMappingURL=data:application/json;base64,${res.map.toString(
    //   "base64"
    // )} */`;
  }

  return {
    css: cssWithSourceMap,
    source: source.toString(),
    json,
    moduleExports: parcelExports,
    dependencies: res.dependencies || [],
  };
}

function getResolvedFilePath(args: { path: string; resolveDir: string }) {
  let matchPath = createMatchPath();
  if (!matchPath) {
    return path.resolve(args.resolveDir, args.path);
  }

  let resolvedPath =
    matchPath(args.path, undefined, undefined, [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mdx",
      ".md",
    ]) || args.path;

  return path.resolve(args.resolveDir, resolvedPath);
}

export function getCssModulesFileReferences(
  config: RemixConfig,
  css: string
): [stylesheetPath: string, stylesheetUrl: string] {
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
 * processed yet. We may encounter limitations with local composition as well.
 * Coming back to this, but we'll initially launch without official support for
 * the `composes` property.
 * https://github.com/remix-run/remix/pull/2489/files#r862282330
 */
function getComposedClassNames(
  prefix: string,
  name: string,
  composes: CssModuleReference[]
) {
  return composes.reduce((className, composed) => {
    // skip dependencies for now
    if (composed.type === "dependency") {
      return className;
    }
    return className + " " + getPrefixedClassName(prefix, composed.name);
  }, name);
}

function getPrefixedClassName(prefix: string, name: string) {
  return prefix + name;
}

export interface CssModuleFileContents {
  css: string;
  source: string;
  json: CssModuleClassMap;
  moduleExports: CssModuleExports;
  dependencies: CssModuleDependency[];
}

export type CssModuleFileMap = Record<string, CssModuleFileContents>;

export interface CssModulesResults {
  stylesheetPath: string;
  stylesheetUrl: string;
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
