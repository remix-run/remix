import path from "path";
import type { Location } from "history";
import type { ComponentType } from "react";
import type { Params } from "react-router";

import type { RemixConfig } from "./config";
import type { RouteData } from "./loaderResults";
import type { RouteManifest } from "./match";
import type { Request, Response } from "./platform";

export type BuildManifest = Record<string, BuildChunk>;

export interface BuildChunk {
  fileName: string;
  imports: string[];
}

export const ManifestServerEntryKey = "__entry_server__";

export function getBuildManifest(serverBuildDirectory: string): BuildManifest {
  let manifestFile = path.join(serverBuildDirectory, "manifest.json");
  return require(manifestFile);
}

export interface RemixEntryContext {
  routeManifest: RouteManifest;
  routeData: RouteData;
  requireRoute(id: string): RouteModule;
}

export interface ServerEntryModule {
  default(
    request: Request,
    responseStatusCode: number,
    context: RemixEntryContext
  ): Promise<Response>;
}

export function getServerEntryModule(
  serverBuildDirectory: string,
  manifest: BuildManifest
): ServerEntryModule {
  let requirePath = path.join(
    serverBuildDirectory,
    manifest[ManifestServerEntryKey].fileName
  );

  return require(requirePath);
}

interface MetaArgs {
  data: any;
  params: Params;
  location: Location;
}

type MetaTagName = string;
type MetaTagContent = string;
type MetaContents = Record<MetaTagName, MetaTagContent>;

export type RouteModules = Record<string, RouteModule>;

export interface RouteModule {
  default: ComponentType;
  meta?(metaArgs: MetaArgs): MetaContents;
}

export function getRouteModules(
  serverBuildDirectory: string,
  routes: RemixConfig["routes"],
  manifest: BuildManifest,
  modules: RouteModules = {}
): RouteModules {
  for (let route of routes) {
    let requirePath = path.join(
      serverBuildDirectory,
      manifest[route.id].fileName
    );

    modules[route.id] = require(requirePath);

    if (route.children) {
      getRouteModules(serverBuildDirectory, route.children, manifest, modules);
    }
  }

  return modules;
}
