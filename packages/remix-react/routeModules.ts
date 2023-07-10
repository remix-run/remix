import type { ComponentType } from "react";
import type { RouterState } from "@remix-run/router";
import type {
  DataRouteMatch,
  Params,
  Location,
  ShouldRevalidateFunction,
} from "react-router-dom";
import type { LoaderFunction, SerializeFrom } from "@remix-run/server-runtime";

import type { AppData } from "./data";
import type { LinkDescriptor } from "./links";
import type { EntryRoute } from "./routes";

type RouteData = RouterState["loaderData"];

export interface RouteModules {
  [routeId: string]: RouteModule;
}

export interface RouteModule {
  CatchBoundary?: CatchBoundaryComponent;
  ErrorBoundary?: ErrorBoundaryComponent | V2_ErrorBoundaryComponent;
  default: RouteComponent;
  handle?: RouteHandle;
  links?: LinksFunction;
  meta?:
    | V1_MetaFunction
    | V1_HtmlMetaDescriptor
    | V2_MetaFunction
    | V2_MetaDescriptor[];
  shouldRevalidate?: ShouldRevalidateFunction;
}

/**
 * A React component that is rendered when the server throws a Response.
 *
 * @deprecated Please enable the v2_errorBoundary flag
 *
 * @see https://remix.run/route/catch-boundary
 */
export type CatchBoundaryComponent = ComponentType<{}>;

/**
 * A React component that is rendered when there is an error on a route.
 *
 * @deprecated Please enable the v2_errorBoundary flag
 *
 * @see https://remix.run/route/error-boundary
 */
export type ErrorBoundaryComponent = ComponentType<{ error: Error }>;

/**
 * V2 version of the ErrorBoundary that eliminates the distinction between
 * Error and Catch Boundaries and behaves like RR 6.4 errorElement and captures
 * errors with useRouteError()
 */
export type V2_ErrorBoundaryComponent = ComponentType;

/**
 * A function that defines `<link>` tags to be inserted into the `<head>` of
 * the document on route transitions.
 *
 * @see https://remix.run/route/meta
 */
export interface LinksFunction {
  (): LinkDescriptor[];
}

/**
 * A function that returns an object of name + content pairs to use for
 * `<meta>` tags for a route. These tags will be merged with (and take
 * precedence over) tags from parent routes.
 *
 * @see https://remix.run/route/meta
 */
export interface V1_MetaFunction {
  (args: {
    data: AppData;
    parentsData: RouteData;
    params: Params;
    location: Location;
  }): HtmlMetaDescriptor;
}

// TODO: Replace in v2
export type MetaFunction = V1_MetaFunction;

export interface RouteMatchWithMeta extends DataRouteMatch {
  meta: V2_MetaDescriptor[];
}

export interface V2_MetaMatch<
  RouteId extends string = string,
  Loader extends LoaderFunction | unknown = unknown
> {
  id: RouteId;
  pathname: DataRouteMatch["pathname"];
  data: Loader extends LoaderFunction ? SerializeFrom<Loader> : unknown;
  handle?: unknown;
  params: DataRouteMatch["params"];
  meta: V2_MetaDescriptor[];
}

export type V2_MetaMatches<
  MatchLoaders extends Record<string, unknown> = Record<string, unknown>
> = Array<
  {
    [K in keyof MatchLoaders]: V2_MetaMatch<
      Exclude<K, number | symbol>,
      MatchLoaders[K]
    >;
  }[keyof MatchLoaders]
>;

export interface V2_MetaArgs<
  Loader extends LoaderFunction | unknown = unknown,
  MatchLoaders extends Record<string, unknown> = Record<string, unknown>
> {
  data:
    | (Loader extends LoaderFunction ? SerializeFrom<Loader> : AppData)
    | undefined;
  params: Params;
  location: Location;
  matches: V2_MetaMatches<MatchLoaders>;
}

export interface V2_MetaFunction<
  Loader extends LoaderFunction | unknown = unknown,
  MatchLoaders extends Record<string, unknown> = Record<string, unknown>
> {
  (args: V2_MetaArgs<Loader, MatchLoaders>): V2_MetaDescriptor[] | undefined;
}

/**
 * A name/content pair used to render `<meta>` tags in a meta function for a
 * route. The value can be either a string, which will render a single `<meta>`
 * tag, or an array of strings that will render multiple tags with the same
 * `name` attribute.
 */
export interface V1_HtmlMetaDescriptor {
  charset?: "utf-8";
  charSet?: "utf-8";
  title?: string;
  [name: string]:
    | null
    | string
    | undefined
    | Record<string, string>
    | Array<Record<string, string> | string>;
}

// TODO: Replace in v2
export type HtmlMetaDescriptor = V1_HtmlMetaDescriptor;

export type V2_MetaDescriptor =
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
export type RouteHandle = any;

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

/**
 * @deprecated The `unstable_shouldReload` function has been removed, so this
 * function will never run and route data will be revalidated on every request.
 * Please update the function name to `shouldRevalidate` and use the
 * `ShouldRevalidateFunction` interface.
 */
export interface ShouldReloadFunction {
  (args: {
    url: URL;
    prevUrl: URL;
    params: Params;
    submission?: Submission;
  }): boolean;
}

interface Submission {
  action: string;
  method: string;
  formData: FormData;
  encType: string;
  key: string;
}
