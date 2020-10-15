import path from "path";
import type { Location } from "history";
import type { ComponentType } from "react";
import type { Params } from "react-router";
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

export const AssetManifestFilename = "asset-manifest.json";
export const ServerManifestFilename = "server-manifest.json";

/**
 * A module that renders the HTML on the server.
 */
export interface ServerEntryModule {
  default(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    context: EntryContext
  ): Promise<Response>;
}

export interface RouteModules {
  [routeId: string]: RouteModule;
}

/**
 * A module that contains info about a route including headers, meta tags, and
 * the route component for rendering HTML markup.
 */
export interface RouteModule {
  default: ComponentType;
  headers?: HeadersFunction;
  meta?: MetaFunction;
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

/**
 * Reads the browser manifest from the build on the filesystem.
 */
export function getAssetManifest(dir: string): AssetManifest {
  let file = path.resolve(dir, AssetManifestFilename);
  return require(file);
}

/**
 * Reads the server manifest from the build on the filesystem.
 */
export function getServerManifest(dir: string): ServerManifest {
  let file = path.resolve(dir, ServerManifestFilename);
  return require(file);
}

/**
 * Gets the serve entry module from the build on the filesystem.
 */
export function getServerEntryModule(
  dir: string,
  manifest: ServerManifest
): ServerEntryModule {
  let file = path.resolve(dir, manifest["entry-server"].fileName);
  return require(file);
}

/**
 * Gets all route modules from the build on the filesystem.
 */
export function getRouteModules(
  dir: string,
  routeManifest: RemixConfig["routeManifest"],
  manifest: ServerManifest
): RouteModules {
  return Object.keys(routeManifest).reduce((routeModules, routeId) => {
    let file = path.join(dir, manifest[routeId].fileName);
    routeModules[routeId] = require(file);
    return routeModules;
  }, {} as RouteModules);
}

/**
 * Fetches the asset manifest from the asset server.
 */
export async function getDevAssetManifest(
  remixRunOrigin: string
): Promise<AssetManifest> {
  let res = await fetch(remixRunOrigin + AssetManifestFilename);
  return res.json();
}
