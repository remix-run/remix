import path from "path";
import type { Location } from "history";
import type { ComponentType } from "react";
import type { Params } from "react-router";

import type { EntryContext, RouteData } from "./entry";
import { loadServerManifest } from "./buildManifest";
import type { Headers, HeadersInit, Request, Response } from "./fetch";
import type { LinkDescriptor } from "./links";
import invariant from "./invariant";

/**
 * An object of data returned from the server's `getLoadContext` function. This
 * will be passed to the data loaders.
 */
export type AppLoadContext = any;

/**
 * Some data that was returned from a route data loader.
 */
export type AppData = any;

/**
 * A React component that is rendered for a route.
 */
export type RouteComponent = ComponentType;

/**
 * A React component that is rendered when there is an error on a route.
 */
export type ErrorBoundaryComponent = ComponentType<{ error: Error }>;

/**
 * A function that returns HTTP headers to be used for a route. These headers
 * will be merged with (and take precedence over) headers from parent routes.
 */
export interface HeadersFunction {
  (args: { loaderHeaders: Headers; parentHeaders: Headers }):
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
 * A function that defines `<link>` tags to be inserted into the `<head>` of
 * the document on route transitions.
 */
export interface LinksFunction {
  (args: { data: RouteData[string] }): LinkDescriptor[];
}

/**
 * A function that loads data for a route.
 */
export interface LoaderFunction {
  (args: { request: Request; context: AppLoadContext; params: Params }):
    | Promise<AppData>
    | AppData;
}

/**
 * A function that handles data mutations for a route.
 */
export interface ActionFunction {
  (args: { request: Request; context: AppLoadContext; params: Params }):
    | Promise<Response>
    | Response;
}

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
  links?: LinksFunction;
  handle?: any;
}

export interface RouteModules {
  [routeId: string]: RouteModule;
}

/**
 * Gets a route module from the build on the filesystem.
 */
export function loadRouteModule(dir: string, routeId: string): RouteModule {
  let manifest = loadServerManifest(dir);

  invariant(
    manifest.entries[routeId],
    `Missing entry for route "${routeId}" in the server manifest`
  );

  return loadModule(path.resolve(dir, manifest.entries[routeId].file));
}

/**
 * Loads many route modules from the build and returns them in an object keyed
 * by route id.
 */
export function loadRouteModules(
  dir: string,
  routeIds: string[]
): RouteModules {
  return routeIds.reduce((memo, id) => {
    memo[id] = loadRouteModule(dir, id);
    return memo;
  }, {} as RouteModules);
}

/**
 * A module that serves as the entry point for a Remix app during server
 * rendering.
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
 * Gets the server entry module from the build on the filesystem.
 */
export function loadServerEntryModule(dir: string): ServerEntryModule {
  let manifest = loadServerManifest(dir);

  invariant(
    manifest.entries["entry.server"],
    `Missing entry for "entry.server" in the server manifest`
  );

  return loadModule(path.resolve(dir, manifest.entries["entry.server"].file));
}

function loadModule(id: string) {
  return require(id);
}
