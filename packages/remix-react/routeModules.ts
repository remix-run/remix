// TODO: We eventually might not want to import anything directly from `history`
// and leverage `react-router` here instead
import type { Location } from "history";
import type { ComponentType } from "react";
import type { Params } from "react-router"; // TODO: import/export from react-router-dom

import type { AppData } from "./data";
import type { LinkDescriptor } from "./links";
import type { ClientRoute, EntryRoute } from "./routes";
import type { RouteData } from "./routeData";
import type { RouteMatch as BaseRouteMatch } from "./routeMatching";
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
  meta?:
    | V1_MetaFunction
    | V1_HtmlMetaDescriptor
    | V2_MetaFunction
    | V2_HtmlMetaDescriptor[];
  unstable_shouldReload?: ShouldReloadFunction;
}

/**
 * A React component that is rendered when the server throws a Response.
 *
 * @see https://remix.run/api/conventions#catchboundary
 */
export type CatchBoundaryComponent = ComponentType<{}>;

/**
 * A React component that is rendered when there is an error on a route.
 *
 * @see https://remix.run/api/conventions#errorboundary
 */
export type ErrorBoundaryComponent = ComponentType<{ error: Error }>;

/**
 * A function that defines `<link>` tags to be inserted into the `<head>` of
 * the document on route transitions.
 *
 * @see https://remix.run/api/remix#meta-links-scripts
 */
export interface LinksFunction {
  (): LinkDescriptor[];
}

/**
 * A function that returns an object of name + content pairs to use for
 * `<meta>` tags for a route. These tags will be merged with (and take
 * precedence over) tags from parent routes.
 *
 * @see https://remix.run/api/remix#meta-links-scripts
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

export interface RouteMatchWithMeta<Route> extends BaseRouteMatch<Route> {
  meta: V2_HtmlMetaDescriptor[];
}

export interface V2_MetaFunction {
  (args: {
    data: AppData;
    parentsData: RouteData;
    params: Params;
    location: Location;
    matches: RouteMatchWithMeta<ClientRoute>[];
  }): V2_HtmlMetaDescriptor[] | undefined;
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

export type V2_HtmlMetaDescriptor =
  | { charSet: "utf-8" }
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { httpEquiv: string; content: string }
  | { [name: string]: string };

/**
 * During client side transitions Remix will optimize reloading of routes that
 * are currently on the page by avoiding loading routes that aren't changing.
 * However, in some cases, like form submissions or search params Remix doesn't
 * know which routes need to be reloaded so it reloads them all to be safe.
 *
 * This function lets apps further optimize by returning `false` when Remix is
 * about to reload the route. A common case is a root loader with nothing but
 * environment variables: after form submissions the root probably doesn't need
 * to be reloaded.
 *
 * @see https://remix.run/api/conventions#unstable_shouldreload
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
 *
 * @see https://remix.run/api/conventions#handle
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
    let routeModule = await import(/* webpackIgnore: true */ route.module);
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
