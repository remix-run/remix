// Local patched copy of https://github.com/indooorsman/esbuild-css-modules-plugin
// More details in readme and license included in plugin's root directory

/* eslint-disable */
import type { OnLoadResult, Plugin, PluginBuild } from "esbuild";
import BuildCache from "./lib/cache";

declare type GenerateScopedNameFunction = (
  name: string,
  filename: string,
  css: string
) => string;

declare type LocalsConventionFunction = (
  originalClassName: string,
  generatedClassName: string,
  inputFile: string
) => string;

declare class Loader {
  constructor(root: string, plugins: Plugin[]);

  fetch(
    file: string,
    relativeTo: string,
    depTrace: string
  ): Promise<{ [key: string]: string }>;

  finalSource?: string | undefined;
}

declare interface CssModulesOptions {
  getJSON?(
    cssFilename: string,
    json: { [name: string]: string },
    outputFilename?: string
  ): void;

  localsConvention?:
    | "camelCase"
    | "camelCaseOnly"
    | "dashes"
    | "dashesOnly"
    | LocalsConventionFunction;

  scopeBehaviour?: "global" | "local";
  globalModulePaths?: RegExp[];

  generateScopedName?: string | GenerateScopedNameFunction;

  hashPrefix?: string;
  exportGlobals?: boolean;
  root?: string;

  Loader?: typeof Loader;

  resolve?: (file: string) => string | Promise<string>;
}

declare interface PluginOptions {
  inject?: boolean | string | ((css: string, digest: string) => string);
  localsConvention?: CssModulesOptions["localsConvention"];
  generateScopedName?: CssModulesOptions["generateScopedName"];
  cssModulesOption?: CssModulesOptions;
  filter?: RegExp;
  v2?: boolean;
  generateTsFile?: boolean;
  v2CssModulesOption?: {
    /**
     * refer to: https://github.com/parcel-bundler/parcel-css/releases/tag/v1.9.0
     */
    dashedIndents?: boolean;
    /**
     * The currently supported segments are:
     * [name] - the base name of the CSS file, without the extension
     * [hash] - a hash of the full file path
     * [local] - the original class name
     */
    pattern?: string;
  };
  root?: string;
  package?: {
    name: string;
    main?: string;
    module?: string;
    version?: string;
  };
  usePascalCase?: boolean;
}

declare interface BuildContext {
  // CHANGE: The buildId property is now optional because we no longer
  // generate it when options.inject is false
  buildId?: string;
  buildRoot: string;
  packageRoot?: string;
  packageVersion: string;
  log: (...args: any[]) => void;
  relative: (to: string) => `.${string}`;
  cache: BuildCache;
}

declare function CssModulesPlugin(options?: PluginOptions): Plugin;

declare namespace CssModulesPlugin {
  export type Options = PluginOptions;
  export interface Build extends PluginBuild {
    context: BuildContext;
  }
}

export = CssModulesPlugin;
