import type { ComponentType, ReactNode } from "react";
import * as React from "react";
import type { Params } from "react-router";

import type { RouteModules, ShouldReloadFunction } from "./routeModules";
import { loadRouteModule } from "./routeModules";
import {
  extractData,
  fetchData,
  isCatchResponse,
  isRedirectResponse,
} from "./data";
import type { Submission } from "./transition";
import { CatchValue, TransitionRedirect } from "./transition";
import { prefetchStyleLinks } from "./links";
import invariant from "./invariant";
import { Outlet } from ".";

export interface RouteManifest<Route> {
  [routeId: string]: Route;
}

// NOTE: make sure to change the Route in server-runtime if you change this
interface Route {
  caseSensitive?: boolean;
  id: string;
  path?: string;
  index?: boolean;
}

// NOTE: make sure to change the EntryRoute in server-runtime if you change this
export interface EntryRoute extends Route {
  hasAction: boolean;
  hasLoader: boolean;
  hasCatchBoundary: boolean;
  hasErrorBoundary: boolean;
  imports?: string[];
  module: string;
  parentId?: string;
}

export type RouteDataFunction = {
  (args: {
    /**
     * Parsed params from the route path
     */
    params: Params;

    /**
     * The url to be loaded, resolved to the matched route.
     */
    url: URL; // resolved route

    /**
     * Will be present if being called from `<Form>` or `useSubmit`
     */
    submission?: Submission;

    /**
     * Attach this signal to fetch (or whatever else) to abort your
     * implementation when a load/action is aborted.
     */
    signal: AbortSignal;
  }): Promise<any> | any;
};

export interface ClientRoute extends Route {
  loader?: RouteDataFunction;
  action: RouteDataFunction;
  shouldReload?: ShouldReloadFunction;
  ErrorBoundary?: any;
  CatchBoundary?: any;
  children?: ClientRoute[];
  element: ReactNode;
  module: string;
  hasLoader: boolean;
}

type RemixRouteComponentType = ComponentType<{ id: string }>;

export function createClientRoute(
  entryRoute: EntryRoute,
  routeModulesCache: RouteModules,
  Component: RemixRouteComponentType
): ClientRoute {
  return {
    caseSensitive: !!entryRoute?.caseSensitive,
    // If this route doesn't have a module, then it's an inserted parent path
    // route, and it should just render it's children through an outlet
    element: entryRoute.module ? <Component id={entryRoute.id} /> : <Outlet />,
    id: entryRoute.id,
    path: entryRoute.path,
    index: entryRoute.index,
    module: entryRoute.module,
    loader: createLoader(entryRoute, routeModulesCache),
    action: createAction(entryRoute, routeModulesCache),
    shouldReload: createShouldReload(entryRoute, routeModulesCache),
    ErrorBoundary: entryRoute.hasErrorBoundary,
    CatchBoundary: entryRoute.hasCatchBoundary,
    hasLoader: entryRoute.hasLoader,
  };
}

export function createClientRoutes(
  routeManifest: RouteManifest<EntryRoute>,
  routeModulesCache: RouteModules,
  Component: RemixRouteComponentType
): ClientRoute[] {
  let routes = createHierarchicalRoutes<ClientRoute>(
    routeManifest,
    (id, path) =>
      createClientRoute(
        routeManifest[id] || { id, path },
        routeModulesCache,
        Component
      )
  );
  return routes || [];
}

function createShouldReload(route: EntryRoute, routeModules: RouteModules) {
  let shouldReload: ShouldReloadFunction = (arg) => {
    let module = routeModules[route.id];
    invariant(module, `Expected route module to be loaded for ${route.id}`);
    if (module.unstable_shouldReload) {
      return module.unstable_shouldReload(arg);
    }
    return true;
  };

  return shouldReload;
}

async function loadRouteModuleWithBlockingLinks(
  route: EntryRoute,
  routeModules: RouteModules
) {
  let routeModule = await loadRouteModule(route, routeModules);
  await prefetchStyleLinks(routeModule);
  return routeModule;
}

function createLoader(route: EntryRoute, routeModules: RouteModules) {
  let loader: ClientRoute["loader"] = async ({ url, signal, submission }) => {
    if (route.hasLoader) {
      let [result] = await Promise.all([
        fetchData(url, route.id, signal, submission),
        loadRouteModuleWithBlockingLinks(route, routeModules),
      ]);

      if (result instanceof Error) throw result;

      let redirect = await checkRedirect(result);
      if (redirect) return redirect;

      if (isCatchResponse(result)) {
        throw new CatchValue(
          result.status,
          result.statusText,
          await extractData(result)
        );
      }

      return extractData(result);
    } else {
      await loadRouteModuleWithBlockingLinks(route, routeModules);
    }
  };

  return loader;
}

function createAction(route: EntryRoute, routeModules: RouteModules) {
  let action: ClientRoute["action"] = async ({ url, signal, submission }) => {
    if (!route.hasAction) {
      console.error(
        `Route "${route.id}" does not have an action, but you are trying ` +
          `to submit to it. To fix this, please add an \`action\` function to the route`
      );
    }

    let result = await fetchData(url, route.id, signal, submission);

    if (result instanceof Error) {
      throw result;
    }

    let redirect = await checkRedirect(result);
    if (redirect) return redirect;

    await loadRouteModuleWithBlockingLinks(route, routeModules);

    if (isCatchResponse(result)) {
      throw new CatchValue(
        result.status,
        result.statusText,
        await extractData(result)
      );
    }

    return extractData(result);
  };

  return action;
}

async function checkRedirect(
  response: Response
): Promise<null | TransitionRedirect> {
  if (isRedirectResponse(response)) {
    let url = new URL(
      response.headers.get("X-Remix-Redirect")!,
      window.location.origin
    );

    if (url.origin !== window.location.origin) {
      await new Promise(() => {
        window.location.replace(url.href);
      });
    } else {
      return new TransitionRedirect(
        url.pathname + url.search + url.hash,
        response.headers.get("X-Remix-Revalidate") !== null
      );
    }
  }

  return null;
}

interface BaseManifestRoute {
  id: string;
  index?: boolean;
  path?: string;
  parentId?: string;
}

type BaseHierarchyRoute<T> = T & {
  id: string;
  path?: string;
  children?: BaseHierarchyRoute<T>[];
};

/**
 * NOTE: This function is duplicated in remix-dev, remix-react, and
 * remix-server-runtime so if you make changes please make them in all 3
 * locations. We'll look into DRY-ing this up after we layer Remix on top of
 * react-router@6.4
 *
 * Generic reusable function to convert a manifest into a react-router style
 * route hierarchy.  For use in server-side and client-side route creation,
 * as well and `remix routes` to keep them all in sync.
 *
 * This also handles inserting "folder" parent routes to help disambiguate
 * between pathless layout routes and index routes at the same level
 *
 * @param manifest     Map of string -> Route Object
 * @param createRoute  Function to create a hierarchical route given a manifest
 *                     ignoring children
 * @returns
 */
export function createHierarchicalRoutes<
  HierarchyRoute extends BaseHierarchyRoute<unknown>
>(
  manifest: Record<string, BaseManifestRoute>,
  createRoute: (id: string, path: string | undefined) => HierarchyRoute
): HierarchyRoute[] {
  function recurse(parentId?: string) {
    // Our manifest flattens index routes and their paths into a single
    // per-route-file entry, so we use this to track which index routes need
    // to be split back into a hierarchical pattern
    let indexRoutesWithPath: string[] = [];
    let children: HierarchyRoute[] = [];

    Object.values(manifest).forEach((route) => {
      if (route.parentId == parentId) {
        if (route.index && route.path) {
          indexRoutesWithPath.push(route.path);
        }
        children.push({
          ...createRoute(route.id, route.path),
          children: recurse(route.id),
        });
      }
    });

    // For each index route that _also_ had a path, create a new parent route
    // for the path and nest the index route and any other matching path routes
    indexRoutesWithPath.forEach((path) => {
      let otherPathRoutes: HierarchyRoute[] = [];
      let dupPathRoutes: HierarchyRoute[] = [];
      children.forEach((r) => {
        if (r.path === path) {
          dupPathRoutes.push(r);
        } else {
          otherPathRoutes.push(r);
        }
      });
      let folderRoute = {
        ...createRoute(`routes/${path}`, path),
        children: dupPathRoutes.map((r) => ({ ...r, path: undefined })),
      };
      children = [...otherPathRoutes, folderRoute];
    });

    return children;
  }

  return recurse();
}
