import path from "path";
import type { Location } from "history";
import type { ComponentType } from "react";
import type { Params } from "react-router";

import type { EntryContext, RouteData } from "./entry";
import type { ServerManifest } from "./buildManifest";
import type { Headers, HeadersInit, Request, Response } from "./fetch";
import type { Session } from "./sessions";
import invariant from "./invariant";

/**
 * An object of data returned from the server's `getLoadContext` function. This
 * will be passed to the data loaders.
 */
export type AppLoadContext = any;

/**
 * Some data that was returned from a route (or global) data loader.
 */
export type AppData = any;

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

/**
 * A module that is used to load global data for the app.
 */
export interface GlobalDataModule {
  loader?: LoaderFunction;
}

export type RouteComponent = ComponentType;
export type ErrorBoundaryComponent = ComponentType<{ error: Error }>;

/**
 * A module that contains info about a route including headers, meta tags, and
 * the route component for rendering HTML markup.
 */
export interface RouteModule {
  default: RouteComponent;
  ErrorBoundary?: ErrorBoundaryComponent;
  headers?: HeadersFunction;
  meta?: MetaFunction;
  loader?: LoaderFunction;
  action?: ActionFunction;
}

export interface RouteModules {
  [routeId: string]: RouteModule;
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
 * `<meta>` tags for a route. These tags will be merged with (and take
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
 * A function that loads data for a route.
 */
export interface LoaderFunction {
  (arg: {
    request: Request;
    session: Session;
    context: AppLoadContext;
    params: Params;
  }): Promise<AppData> | AppData;
}

/**
 * A function that handles data mutations for a route.
 */
export interface ActionFunction {
  (arg: {
    request: Request;
    session: Session;
    context: AppLoadContext;
    params: Params;
  }): Promise<Response> | Response;
}

/**
 * Gets the server entry module from the build on the filesystem.
 */
export function loadServerEntryModule(
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
 * Gets the global data module from the build on the filesystem.
 */
export function loadGlobalDataModule(
  buildDir: string,
  manifest: ServerManifest
): GlobalDataModule | null {
  if (!manifest.entries["global-data"]) {
    return null;
  }

  return loadModule(
    path.resolve(buildDir, manifest.entries["global-data"].file)
  );
}

/**
 * Gets a route module from the build on the filesystem.
 */
export function loadRouteModule(
  buildDir: string,
  manifest: ServerManifest,
  routeId: string
): RouteModule {
  invariant(
    manifest.entries[routeId],
    `Missing entry for route "${routeId}" in the server manifest`
  );

  return loadModule(path.resolve(buildDir, manifest.entries[routeId].file));
}

function loadModule(id: string) {
  return require(id);
}
