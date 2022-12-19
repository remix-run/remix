import * as React from "react";
import type {
  AssetsManifest,
  EntryContext,
  EntryRoute,
  RouteData,
  RouteManifest,
  RouteModules,
} from "@remix-run/react";
import {
  createStaticRouter,
  StaticRouterProvider,
} from "react-router-dom/server";
import type { RouteObject, Location } from "react-router-dom";
import { matchRoutes, json } from "react-router-dom";
import type {
  AgnosticDataRouteObject,
  InitialEntry,
  StaticHandler,
  StaticHandlerContext,
} from "@remix-run/router";
import { createStaticHandler } from "@remix-run/router";
import { RemixContext } from "@remix-run/react/dist/components";

type RemixStubOptions = {
  /**
   *  The initial entries in the history stack. This allows you to start a test with
   *  multiple locations already in the history stack (for testing a back navigation, etc.)
   *  The test will default to the last entry in initialEntries if no initialIndex is provided.
   *  e.g. initialEntries={["/home", "/about", "/contact"]}
   */
  initialEntries?: InitialEntry[];

  /**
   *  Used to set the route's initial loader data.
   *  e.g. initialLoaderData={{ "/contact": { locale: "en-US" } }}
   */
  initialLoaderData?: RouteData;

  /**
   * Used to set the route's initial loader headers.
   * e.g. initialLoaderHeaders={{ "/contact": { "Content-Type": "application/json" } }}
   */
  initialLoaderHeaders?: Record<string, Headers>;

  /**
   *  Used to set the route's initial action data.
   *  e.g. initialActionData={{ "/login": { errors: { email: "invalid email" } }}
   */
  initialActionData?: RouteData;

  /**
   * Used to set the route's initial action headers.
   */
  initialActionHeaders?: Record<string, Headers>;

  /**
   * Used to set the route's initial status code.
   */
  initialStatusCode?: number;

  /**
   * The initial index in the history stack to render. This allows you to start a test at a specific entry.
   * It defaults to the last entry in initialEntries.
   * e.g.
   *   initialEntries: ["/", "/events/123"]
   *   initialIndex: 1 // start at "/events/123"
   */
  initialIndex?: number;
};

type RemixConfigFuture = Partial<EntryContext["future"]>;

export function createRemixStub(
  routes: RouteObject[],
  remixConfigFuture?: RemixConfigFuture
) {
  // Setup request handler to handle requests to the mock routes
  let staticHandler = createStaticHandler(routes);
  return function RemixStub({
    initialEntries,
    initialIndex,
    initialLoaderData = {},
    initialActionData,
    initialActionHeaders,
    initialLoaderHeaders,
    initialStatusCode: statusCode,
  }: RemixStubOptions) {
    let location = React.useRef<Location>();

    React.useLayoutEffect(() => {
      return router.subscribe((state) => {
        location.current = state.location;
      });
    }, []);

    let manifest = createManifest(staticHandler.dataRoutes);
    let matches = matchRoutes(routes, location.current!) || [];
    let future: EntryContext["future"] = {
      v2_meta: false,
      ...remixConfigFuture,
    };
    let routeModules = createRouteModules(staticHandler.dataRoutes);

    let staticHandlerContext: StaticHandlerContext = {
      actionData: initialActionData || null,
      actionHeaders: initialActionHeaders || {},
      loaderData: initialLoaderData || {},
      loaderHeaders: initialLoaderHeaders || {},
      basename: "",
      errors: null,
      location: location.current!,
      matches,
      statusCode: statusCode || 200,
    };

    let router = createStaticRouter(
      staticHandler.dataRoutes,
      staticHandlerContext
    );

    // Patch fetch so that mock routes can handle action/loader requests
    monkeyPatchFetch(staticHandler);

    return (
      <RemixContext.Provider value={{ manifest, routeModules, future }}>
        <StaticRouterProvider router={router} context={staticHandlerContext} />
      </RemixContext.Provider>
    );
  };
}

function createManifest(routes: AgnosticDataRouteObject[]): AssetsManifest {
  return {
    routes: createRouteManifest(routes),
    entry: { imports: [], module: "" },
    url: "",
    version: "",
  };
}

function createRouteManifest(
  routes: AgnosticDataRouteObject[],
  manifest?: RouteManifest<EntryRoute>,
  parentId?: string
): RouteManifest<EntryRoute> {
  return routes.reduce((manifest, route) => {
    if (route.children) {
      createRouteManifest(route.children, manifest, route.id);
    }
    manifest[route.id!] = convertToEntryRoute(route, parentId);
    return manifest;
  }, manifest || {});
}

function createRouteModules(
  routes: AgnosticDataRouteObject[],
  routeModules?: RouteModules
): RouteModules {
  return routes.reduce((modules, route) => {
    if (route.children) {
      createRouteModules(route.children, modules);
    }

    modules[route.id!] = {
      CatchBoundary: undefined,
      ErrorBoundary: undefined,
      // @ts-expect-error - types are still `agnostic` here
      default: () => route.element,
      handle: route.handle,
      links: undefined,
      meta: undefined,
      shouldRevalidate: undefined,
    };
    return modules;
  }, routeModules || {});
}

const originalFetch =
  typeof global !== "undefined" ? global.fetch : window.fetch;

function monkeyPatchFetch(staticHandler: StaticHandler) {
  let fetchPatch = async (
    input: RequestInfo | URL,
    init: RequestInit = {}
  ): Promise<Response> => {
    let request = new Request(input, init);
    let url = new URL(request.url);

    // if we have matches, send the request to mock routes via @remix-run/router rather than the normal
    // @remix-run/server-runtime so that stubs can also be used in browser environments.
    let matches = matchRoutes(staticHandler.dataRoutes, url);
    if (matches && matches.length > 0) {
      let response = await staticHandler.queryRoute(request);

      if (response instanceof Response) {
        return response;
      }

      return json(response);
    }

    // if no matches, passthrough to the original fetch as mock routes couldn't handle the request.
    return originalFetch(request, init);
  };

  globalThis.fetch = fetchPatch;
}

function convertToEntryRoute(
  route: AgnosticDataRouteObject,
  parentId?: string
): EntryRoute {
  return {
    id: route.id!,
    index: route.index,
    caseSensitive: route.caseSensitive,
    path: route.path,
    parentId,
    hasAction: !!route.action,
    hasLoader: !!route.loader,
    module: "",
    hasCatchBoundary: false,
    hasErrorBoundary: false,
  };
}

// Converts route data from a path based index to a route id index value.
// e.g. { "/post/:postId": post } to { "0": post }
// TODO: may not need
function convertRouteData(
  routes: AgnosticDataRouteObject[],
  initialRouteData?: RouteData,
  routeData: RouteData = {}
): RouteData | undefined {
  if (!initialRouteData) return undefined;
  return routes.reduce<RouteData>((data, route) => {
    if (route.children) {
      convertRouteData(route.children, initialRouteData, data);
    }
    // Check if any of the initial route data entries match this route
    Object.keys(initialRouteData).forEach((routePath) => {
      if (
        routePath === route.path ||
        // Let '/' refer to the root routes data
        (routePath === "/" && route.id === "0" && !route.path)
      ) {
        data[route.id!] = initialRouteData[routePath];
      }
    });
    return data;
  }, routeData);
}
