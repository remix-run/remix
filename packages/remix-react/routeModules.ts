import type { ComponentType } from "react";
import type { UNSAFE_DeferredData as DeferredData } from "@remix-run/router";
import type {
  ActionFunction as RRActionFunction,
  ActionFunctionArgs as RRActionFunctionArgs,
  LoaderFunction as RRLoaderFunction,
  LoaderFunctionArgs as RRLoaderFunctionArgs,
  DataRouteMatch,
  Params,
  Location,
  ShouldRevalidateFunction,
} from "react-router-dom";
import type { LoaderFunction, SerializeFrom } from "@remix-run/server-runtime";

import type { AppData } from "./data";
import type { LinkDescriptor } from "./links";
import type { EntryRoute } from "./routes";

export interface RouteModules {
  [routeId: string]: RouteModule;
}

export interface RouteModule {
  clientAction?: ClientActionFunction;
  clientLoader?: ClientLoaderFunction;
  ErrorBoundary?: ErrorBoundaryComponent;
  Fallback?: FallbackComponent;
  default: RouteComponent;
  handle?: RouteHandle;
  links?: LinksFunction;
  meta?: MetaFunction;
  shouldRevalidate?: ShouldRevalidateFunction;
}

export type ClientDataFunctionArgs = RRActionFunctionArgs<undefined> &
  RRLoaderFunctionArgs<undefined> & {
    serverFetch: () => Promise<Response | DeferredData | null>;
  };

export type ClientActionFunction = (
  args: ClientDataFunctionArgs
) => ReturnType<RRActionFunction>;

export type ClientActionFunctionArgs = ClientDataFunctionArgs;

export type ClientLoaderFunction = (
  args: ClientDataFunctionArgs
) => ReturnType<RRLoaderFunction>;

export type ClientLoaderFunctionArgs = ClientDataFunctionArgs;

/**
 * ErrorBoundary to display for this route
 */
export type ErrorBoundaryComponent = ComponentType;

/**
 * `<RouteProvider fallbackElement>` component to render on initial loads
 * when client loaders are present
 */
export type FallbackComponent = ComponentType;

/**
 * A function that defines `<link>` tags to be inserted into the `<head>` of
 * the document on route transitions.
 *
 * @see https://remix.run/route/meta
 */
export interface LinksFunction {
  (): LinkDescriptor[];
}

export interface MetaMatch<
  RouteId extends string = string,
  Loader extends LoaderFunction | unknown = unknown
> {
  id: RouteId;
  pathname: DataRouteMatch["pathname"];
  data: Loader extends LoaderFunction ? SerializeFrom<Loader> : unknown;
  handle?: RouteHandle;
  params: DataRouteMatch["params"];
  meta: MetaDescriptor[];
  error?: unknown;
}

export type MetaMatches<
  MatchLoaders extends Record<string, LoaderFunction | unknown> = Record<
    string,
    unknown
  >
> = Array<
  {
    [K in keyof MatchLoaders]: MetaMatch<
      Exclude<K, number | symbol>,
      MatchLoaders[K]
    >;
  }[keyof MatchLoaders]
>;

export interface MetaArgs<
  Loader extends LoaderFunction | unknown = unknown,
  MatchLoaders extends Record<string, LoaderFunction | unknown> = Record<
    string,
    unknown
  >
> {
  data:
    | (Loader extends LoaderFunction ? SerializeFrom<Loader> : AppData)
    | undefined;
  params: Params;
  location: Location;
  matches: MetaMatches<MatchLoaders>;
  error?: unknown;
}

export interface MetaFunction<
  Loader extends LoaderFunction | unknown = unknown,
  MatchLoaders extends Record<string, LoaderFunction | unknown> = Record<
    string,
    unknown
  >
> {
  (args: MetaArgs<Loader, MatchLoaders>): MetaDescriptor[] | undefined;
}

export type MetaDescriptor =
  | { charSet: "utf-8" }
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { httpEquiv: string; content: string }
  | { "script:ld+json": LdJsonObject }
  | { tagName: "meta" | "link"; [name: string]: string }
  | { [name: string]: unknown };

type LdJsonObject = { [Key in string]: LdJsonValue } & {
  [Key in string]?: LdJsonValue | undefined;
};
type LdJsonArray = LdJsonValue[] | readonly LdJsonValue[];
type LdJsonPrimitive = string | number | boolean | null;
type LdJsonValue = LdJsonPrimitive | LdJsonObject | LdJsonArray;

/**
 * A React component that is rendered for a route.
 */
export type RouteComponent = ComponentType<{}>;

/**
 * An arbitrary object that is associated with a route.
 *
 * @see https://remix.run/route/handle
 */
export type RouteHandle = unknown;

export async function loadRouteModule(
  route: EntryRoute,
  routeModulesCache: RouteModules
): Promise<RouteModule> {
  if (route.id in routeModulesCache) {
    return routeModulesCache[route.id];
  }

  try {
    let routeModule = await import(/* webpackIgnore: true */ route.module);
    routeModulesCache[route.id] = routeModule;
    return routeModule;
  } catch (error: unknown) {
    // User got caught in the middle of a deploy and the CDN no longer has the
    // asset we're trying to import! Reload from the server and the user
    // (should) get the new manifest--unless the developer purged the static
    // assets, the manifest path, but not the documents 😬
    window.location.reload();
    return new Promise(() => {
      // check out of this hook cause the DJs never gonna re[s]olve this
    });
  }
}
