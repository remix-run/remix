import path from "path";
import type { Location } from "history";
import type { Component } from "react";
import type { Params } from "react-router";

import type { RemixConfig } from "./config";
import type { LoaderResult } from "./loaderResults";
import type { RemixRouteMatch } from "./match";
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

export interface RemixServerContext {
  matches: RemixRouteMatch[];
  data: LoaderResult[];
  partialManifest: BuildManifest;
  requireRoute(id: string): RouteModule;
}

export interface ServerEntryModule {
  default(
    request: Request,
    responseStatusCode: number,
    context: RemixServerContext
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
  default: Component;
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
