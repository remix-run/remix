import type { AppState } from "./errors";
import type { RouteManifest, EntryRoute } from "./routes";
import type { RouteData } from "./routeData";
import type { RouteMatch } from "./routeMatching";
import type { RouteModules } from "./routeModules";

export interface EntryContext {
  appState: AppState;
  manifest: AssetsManifest;
  matches: RouteMatch<EntryRoute>[];
  routeData: RouteData;
  actionData?: RouteData;
  routeModules: RouteModules;
  serverHandoffString?: string;
}

export interface AssetsManifest {
  entry: {
    imports: string[];
    module: string;
  };
  routes: RouteManifest<EntryRoute>;
  url: string;
  version: string;
  cssModules: CssModulesResults | undefined;
}

// TODO: This should ideally be in one place; duped for now from remix-dev
interface CssModulesResults {
  stylesheetPath: string;
  stylesheetUrl: string;
  moduleMap: CssModuleFileMap;
}

interface CssModuleFileContents {
  css: string;
  sourceMap: string | null;
  json: CssModuleClassMap;
  moduleExports: CssModuleExports;
  dependencies: CssModuleDependency[];
}

type CssModuleFileMap = Record<string, CssModuleFileContents>;

type CssModuleClassMap = Record<string, string>;

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
