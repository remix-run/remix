import path from "path";
import type { Location } from "history";
import type { ComponentType } from "react";
import type { Params } from "react-router";
import requireFromString from "require-from-string";
import type { RollupOutput } from "rollup";
import fetch from "node-fetch";

import type { RemixConfig } from "./config";
import type { EntryContext, RouteData } from "./entry";
import type { Headers, HeadersInit, Request, Response } from "./platform";
import type { BuildManifest } from "./rollup/manifest";

/**
 * A manifest of all assets (JavaScript, CSS, etc.) in the browser build.
 */
export type AssetManifest = BuildManifest;

/**
 * A manifest of all modules in the server build.
 */
export type ServerManifest = BuildManifest;

// export const EntryBrowserManifestKey = "entry-browser";
// export const EntryServerManifestKey = "entry-server";
// export const GlobalStylesManifestKey = "global-styles";

export const AssetManifestFilename = "asset-manifest.json";
export const ServerManifestFilename = "server-manifest.json";

export interface ServerEntryModule {
  default(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    context: EntryContext
  ): Promise<Response>;
}

/**
 * A function that returns HTTP headers to be used for a route. These headers
 * will be merged with (and take precedence over) headers from parent routes.
 */
export interface HeadersFunction {
  (args: { loaderHeaders: Headers; parentsHeaders: Headers }):
    | Headers
    | HeadersInit;
}

/**
 * A function that returns an object of name + content pairs to use for
 * `<meta>` tags for this route. These tags will be merged with (and take
 * precedence over) tags from parent routes.
 */
export interface MetaFunction {
  (args: {
    data: RouteData[string];
    parentsData: RouteData;
    params: Params;
    location: Location;
  }): { [name: string]: string };
}

export interface RouteModule {
  headers?: HeadersFunction;
  meta?: MetaFunction;
  default: ComponentType;
}

export interface RouteModules {
  [routeId: string]: RouteModule;
}

/**
 * Reads the browser manifest from the build on the filesystem.
 */
export function getAssetManifest(serverBuildDirectory: string): BuildManifest {
  let manifestFile = path.resolve(serverBuildDirectory, AssetManifestFilename);
  return require(manifestFile);
}

/**
 * Reads the server manifest from the build on the filesystem.
 */
export function getServerManifest(serverBuildDirectory: string): BuildManifest {
  let manifestFile = path.resolve(serverBuildDirectory, ServerManifestFilename);
  return require(manifestFile);
}

/**
 * Gets the serve entry module from the build on the filesystem.
 */
export function getServerEntryModule(
  serverBuildDirectory: string,
  serverManifest: BuildManifest
): ServerEntryModule {
  let requirePath = path.resolve(
    serverBuildDirectory,
    serverManifest["entry-server"].fileName
  );

  return require(requirePath);
}

/**
 * Gets all route modules from the build on the filesystem.
 */
export function getRouteModules(
  serverBuildDirectory: string,
  routes: RemixConfig["routes"],
  serverManifest: BuildManifest,
  modules: RouteModules = {}
): RouteModules {
  for (let route of routes) {
    let requirePath = path.join(
      serverBuildDirectory,
      serverManifest[route.id].fileName
    );

    modules[route.id] = require(requirePath);

    if (route.children) {
      getRouteModules(
        serverBuildDirectory,
        route.children,
        serverManifest,
        modules
      );
    }
  }

  return modules;
}

/**
 * Fetches the asset manifest from the asset server.
 */
export async function getDevAssetManifest(
  remixRunOrigin: string
): Promise<BuildManifest> {
  let res = await fetch(remixRunOrigin + AssetManifestFilename);
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
    "entry-server"
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
