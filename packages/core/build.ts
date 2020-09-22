import path from "path";
import type { Location } from "history";
import type { ComponentType } from "react";
import type { Params } from "react-router";
import requireFromString from "require-from-string";
import type { RollupOutput, OutputChunk } from "rollup";

import type { RemixConfig } from "./config";
import type { EntryContext, RouteData } from "./entry";
import type { Request, Response } from "./platform";
import type { BuildManifest, BuildChunk } from "./rollup/manifest";
import invariant from "./invariant";

export type { BuildManifest, BuildChunk };

export const ManifestBrowserEntryKey = "__entry_browser__";
export const ManifestServerEntryKey = "__entry_server__";

export const BrowserManifestFilename = "browser-manifest.json";
export const ServerManifestFilename = "server-manifest.json";

export function getBrowserManifest(
  serverBuildDirectory: string
): BuildManifest {
  let manifestFile = path.join(serverBuildDirectory, BrowserManifestFilename);
  return require(manifestFile);
}

export function getServerManifest(serverBuildDirectory: string): BuildManifest {
  let manifestFile = path.join(serverBuildDirectory, ServerManifestFilename);
  return require(manifestFile);
}

export interface ServerEntryModule {
  default(
    request: Request,
    responseStatusCode: number,
    context: EntryContext
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

export function getDevServerEntryModule(
  serverBuildDirectory: string,
  output: RollupOutput["output"]
): ServerEntryModule {
  for (let chunkOrAsset of output) {
    if (
      chunkOrAsset.type === "chunk" &&
      chunkOrAsset.name === ManifestServerEntryKey
    ) {
      let filename = path.resolve(serverBuildDirectory, chunkOrAsset.fileName);
      return requireFromString(chunkOrAsset.code, filename);
    }
  }
}

interface MetaArgs {
  data: RouteData[string];
  params: Params;
  location: Location;
  allData: { [routeId: string]: RouteData[string] };
}

interface MetaContents {
  [name: string]: string;
}

export interface RouteModules {
  [routeId: string]: RouteModule;
}

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

export function getDevRouteModules(
  serverBuildDirectory: string,
  routes: RemixConfig["routes"],
  output: RollupOutput["output"],
  modules: RouteModules = {}
): RouteModules {
  for (let route of routes) {
    let chunk = output.find(
      chunkOrAsset =>
        chunkOrAsset.type === "chunk" && chunkOrAsset.name === route.id
    );

    invariant(
      chunk,
      `Missing chunk in build output for route id "${route.id}"`
    );

    let filename = path.resolve(serverBuildDirectory, chunk.fileName);

    modules[route.id] = requireFromString(
      (chunk as OutputChunk).code,
      filename
    );

    if (route.children) {
      getDevRouteModules(serverBuildDirectory, route.children, output, modules);
    }
  }

  return modules;
}
