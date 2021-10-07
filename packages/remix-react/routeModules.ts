import type { Location } from "history";
import type { ComponentType } from "react";
import type { Params } from "react-router"; // TODO: import/export from react-router-dom

import type { AppData } from "./data";
import type { LinkDescriptor } from "./links";
import type { ClientRoute, EntryRoute } from "./routes";
import type { RouteData } from "./routeData";
import type { Submission } from "./transition";

export interface RouteModules {
  [routeId: string]: RouteModule;
}

export interface RouteModule {
  CatchBoundary?: CatchBoundaryComponent;
  ErrorBoundary?: ErrorBoundaryComponent;
  default: RouteComponent;
  handle?: RouteHandle;
  links?: LinksFunction;
  meta?: MetaFunction | { [name: string]: string };
  unstable_shouldReload?: ShouldReloadFunction;
}

/**
 * A React component that is rendered when the server throws a Response.
 */
 export type CatchBoundaryComponent = ComponentType<{}>;

/**
 * A React component that is rendered when there is an error on a route.
 */
export type ErrorBoundaryComponent = ComponentType<{ error: Error }>;

/**
 * A function that defines `<link>` tags to be inserted into the `<head>` of
 * the document on route transitions.
 */
export interface LinksFunction {
  (): LinkDescriptor[];
}

/**
 * A function that returns an object of name + content pairs to use for
 * `<meta>` tags for a route. These tags will be merged with (and take
 * precedence over) tags from parent routes.
 */
export interface MetaFunction {
  (args: {
    data: AppData;
    parentsData: RouteData;
    params: Params;
    location: Location;
  }): { [name: string]: string };
}

/**
 * During client side transitions Remix will optimize reloading of routes that
 * are currently on the page by avoiding loading routes that aren't changing.
 * However, in some cases, like form submissions or search params Remix doesn't
 * know which routes need to be reloaded so it reloads them all to be safe.
 *
 * This function lets apps further optimize by returning `false` when Remix is
 * about to reload the route. A common case is a root loader with nothing but
 * enviornment variables: after form submissions the root probably doesn't need
 * to be reloaded.
 */
export interface ShouldReloadFunction {
  (args: {
    url: URL;
    prevUrl: URL;
    params: Params;
    submission?: Submission;
  }): boolean;
}

/**
 * A React component that is rendered for a route.
 */
export type RouteComponent = ComponentType<{}>;

/**
 * An arbitrary object that is associated with a route.
 */
export type RouteHandle = any;

export async function loadRouteModule(
  route: EntryRoute | ClientRoute,
  routeModulesCache: RouteModules
): Promise<RouteModule> {
  if (route.id in routeModulesCache) {
    return routeModulesCache[route.id];
  }

  try {
    let routeModule = await import(route.module);
    routeModulesCache[route.id] = routeModule;
    return routeModule;
  } catch (error) {
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
