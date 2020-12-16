import fs from "fs";
import path from "path";
import type { Location } from "history";
import type { ComponentType } from "react";
import type { Params } from "react-router";

import type { EntryContext, RouteData } from "./entry";
import type { Headers, HeadersInit, Request, Response } from "./fetch";
import type { BuildManifest } from "./rollup/manifest";
import invariant from "./invariant";

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

export type ErrorBoundaryComponent = ComponentType<{ error: Error }>;

/**
 * A module that contains info about a route including headers, meta tags, and
 * the route component for rendering HTML markup.
 */
export interface RouteModule {
  default: ComponentType;
  headers?: HeadersFunction;
  meta?: MetaFunction;
  ErrorBoundary?: ErrorBoundaryComponent;
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

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

/**
 * Reads the browser manifest from the build on the filesystem.
 */
export function getAssetManifest(dir: string): AssetManifest {
  return readJson(path.resolve(dir, AssetManifestFilename));
}

/**
 * Reads the server manifest from the build on the filesystem.
 */
export function getServerManifest(dir: string): ServerManifest {
  return readJson(path.resolve(dir, ServerManifestFilename));
}

function loadModule(file: string) {
  return require(file);
}

/**
 * Gets the server entry module from the build on the filesystem.
 */
export function getServerEntryModule(
  buildDir: string,
  manifest: ServerManifest
): ServerEntryModule {
  invariant(
    manifest.entries["entry-server"],
    `Missing entry for "entry-server" in the server manifest`
  );

  return loadModule(
    path.resolve(buildDir, manifest.entries["entry-server"].file)
  );
}

/**
 * Gets route modules from the build on the filesystem.
 */
export function getRouteModules(
  buildDir: string,
  manifest: ServerManifest,
  routeIds: string[]
): RouteModules {
  return routeIds.reduce((routeModules, routeId) => {
    invariant(
      manifest.entries[routeId],
      `Missing entry for route "${routeId}" in the server manifest`
    );

    routeModules[routeId] = loadModule(
      path.join(buildDir, manifest.entries[routeId].file)
    );

    return routeModules;
  }, {} as RouteModules);
}
