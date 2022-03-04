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
  globalStylesheetFilePath: string;
  globalStylesheetFileUrl: string;
  moduleMap: CssModuleFileMap;
}

interface CssModuleFileContents {
  css: string;
  json: CssModuleClassMap;
}

type CssModuleFileMap = Record<string, CssModuleFileContents>;

type CssModuleClassMap = Record<string, string>;
