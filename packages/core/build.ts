import path from "path";
import type { Location } from "history";
import type { ComponentType } from "react";
import type { Params } from "react-router";
import requireFromString from "require-from-string";
import type { RollupOutput } from "rollup";
import fetch from "node-fetch";

import type { RemixConfig } from "./config";
import type { EntryContext, RouteData } from "./entry";
import type { Request, Response } from "./platform";
import type { BuildManifest, BuildChunk } from "./rollup/manifest";

export type { BuildManifest, BuildChunk };

export const BrowserEntryManifestKey = "entry-browser";
export const BrowserEntryStylesManifestKey = "entry-styles";
export const ServerEntryManifestKey = "entry-server";

export const BrowserManifestFilename = "browser-manifest.json";
export const ServerManifestFilename = "server-manifest.json";

export interface ServerEntryModule {
  default(
    request: Request,
    responseStatusCode: number,
    context: EntryContext
  ): Promise<Response>;
}

export interface RouteModule {
  default: ComponentType;
  meta?(metaArgs: MetaArgs): MetaContents;
}

export interface RouteModules {
  [routeId: string]: RouteModule;
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

/**
 * Reads the browser manifest from the build on the filesystem.
 */
export function getBrowserBuildManifest(
  serverBuildDirectory: string
): BuildManifest {
  let manifestFile = path.resolve(
    serverBuildDirectory,
    BrowserManifestFilename
  );

  return require(manifestFile);
}

/**
 * Reads the server manifest from the build on the filesystem.
 */
export function getServerBuildManifest(
  serverBuildDirectory: string
): BuildManifest {
  let manifestFile = path.resolve(serverBuildDirectory, ServerManifestFilename);
  return require(manifestFile);
}

/**
 * Gets the serve entry module from the build on the filesystem.
 */
export function getServerEntryModule(
  serverBuildDirectory: string,
  serverBuildManifest: BuildManifest
): ServerEntryModule {
  let requirePath = path.resolve(
    serverBuildDirectory,
    serverBuildManifest[ServerEntryManifestKey].fileName
  );

  return require(requirePath);
}

/**
 * Gets all route modules from the build on the filesystem.
 */
export function getRouteModules(
  serverBuildDirectory: string,
  routes: RemixConfig["routes"],
  serverBuildManifest: BuildManifest,
  modules: RouteModules = {}
): RouteModules {
  for (let route of routes) {
    let requirePath = path.join(
      serverBuildDirectory,
      serverBuildManifest[route.id].fileName
    );

    modules[route.id] = require(requirePath);

    if (route.children) {
      getRouteModules(
        serverBuildDirectory,
        route.children,
        serverBuildManifest,
        modules
      );
    }
  }

  return modules;
}

/**
 * Fetches the browser manifest from the development server.
 */
export async function getDevBrowserBuildManifest(
  remixRunOrigin: string
): Promise<BuildManifest> {
  let res = await fetch(remixRunOrigin + BrowserManifestFilename);
  return res.json();
}

/**
 * Gets the server entry module from the server build output.
 */
export function getDevServerEntryModule(
  serverBuildDirectory: string,
  serverBuildOutput: RollupOutput["output"]
): ServerEntryModule {
  return requireChunk<ServerEntryModule>(
    serverBuildDirectory,
    serverBuildOutput,
    ServerEntryManifestKey
  );
}

/**
 * Gets the route modules from the server build output.
 */
export function getDevRouteModules(
  serverBuildDirectory: string,
  routes: RemixConfig["routes"],
  serverBuildOutput: RollupOutput["output"],
  modules: RouteModules = {}
): RouteModules {
  for (let route of routes) {
    modules[route.id] = requireChunk<RouteModule>(
      serverBuildDirectory,
      serverBuildOutput,
      route.id
    );

    if (route.children) {
      getDevRouteModules(
        serverBuildDirectory,
        route.children,
        serverBuildOutput,
        modules
      );
    }
  }

  return modules;
}

function requireChunk<T>(
  serverBuildDirectory: string,
  serverBuildOutput: RollupOutput["output"],
  chunkName: string
): T {
  for (let chunkOrAsset of serverBuildOutput) {
    if (chunkOrAsset.type === "chunk" && chunkOrAsset.name === chunkName) {
      let filename = path.resolve(serverBuildDirectory, chunkOrAsset.fileName);
      return requireFromString(chunkOrAsset.code, filename);
    }
  }

  throw new Error(`Missing chunk "${chunkName}" in server build output`);
}
