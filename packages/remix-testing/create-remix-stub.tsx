import * as React from "react";
import {
  unstable_createStaticHandler as createStaticHandler,
  matchRoutes,
} from "@remix-run/router";
import { RemixEntry } from "@remix-run/react";
import type {
  AssetsManifest,
  CatchBoundaryComponent,
  EntryContext,
  EntryRoute,
  RouteData,
  RouteManifest,
  RouteModules,
  ShouldReloadFunction,
} from "@remix-run/react";
import type {
  ErrorBoundaryComponent,
  LinksFunction,
  MetaFunction,
  MemoryHistory,
} from "@remix-run/server-runtime";
import { json, createMemoryHistory } from "@remix-run/server-runtime";
import type {
  InitialEntry,
  StaticHandler,
  LoaderFunction,
  ActionFunction,
  Location,
} from "@remix-run/router";
import type { AgnosticRouteMatch } from "@remix-run/router/dist/utils";
import type { Update } from "@remix-run/router/dist/history";

/**
 * Base RouteObject with common props shared by all types of mock routes
 */
type BaseMockRouteObject = {
  id?: string;
  caseSensitive?: boolean;
  path?: string;
  element?: React.ReactNode | null;
  loader?: LoaderFunction;
  action?: ActionFunction;
  links?: LinksFunction;
  meta?: MetaFunction;
  handle?: any;
  CatchBoundary?: CatchBoundaryComponent;
  ErrorBoundary?: ErrorBoundaryComponent;
  unstable_shouldReload?: ShouldReloadFunction;
};

/**
 * Index routes must not have children
 */
export declare type MockIndexRouteObject = BaseMockRouteObject & {
  children?: undefined;
  index: true;
};

/**
 * Non-index routes may have children, but cannot have index
 */
export declare type MockNonIndexRouteObject = BaseMockRouteObject & {
  children?: MockRouteObject[];
  index?: false;
};

/**
 * A route object represents a logical route, with (optionally) its child
 * routes organized in a tree-like structure.
 */
export declare type MockRouteObject =
  | MockIndexRouteObject
  | MockNonIndexRouteObject;

type RemixStubOptions = {
  /**
   *  The initial entries in the history stack. This allows you to start a test with
   *  multiple locations already in the history stack (for testing a back navigation, etc.)
   *  The test will default to the last entry in initialEntries if no initialIndex is provided.
   *  e.g. initialEntries-(["/home", "/about", "/contact"]}
   */
  initialEntries?: InitialEntry[];

  /**
   *  Used to set the route's initial loader data.
   *  e.g. initialLoaderData={("/contact": {locale: "en-US" }}
   */
  initialLoaderData?: RouteData;

  /**
   *  Used to set the route's initial action data.
   *  e.g. initialActionData={("/login": { errors: { email: "invalid email" } }}
   */
  initialActionData?: RouteData;

  /**
   * The initial index in the history stack to render. This allows you to start a test at a specific entry.
   * It defaults to the last entry in initialEntries.
   * e.g.
   *   initialEntries: ["/", "/events/123"]
   *   initialIndex: 1 // start at "/events/123"
   */
  initialIndex?: number;
};

export function createRemixStub(routes: MockRouteObject[]) {
  // Setup request handler to handle requests to the mock routes
  let { dataRoutes, queryRoute } = createStaticHandler(routes);
  return function RemixStub({
    initialEntries = ["/"],
    initialLoaderData = {},
    initialActionData,
    initialIndex,
  }: RemixStubOptions) {
    let historyRef = React.useRef<MemoryHistory>();
    if (historyRef.current == null) {
      historyRef.current = createMemoryHistory({
        initialEntries: initialEntries,
        initialIndex: initialIndex,
      });
    }

    let history = historyRef.current;
    let [state, dispatch] = React.useReducer(
      (_: Update, update: Update) => update,
      {
        action: history.action,
        location: history.location,
      }
    );

    React.useLayoutEffect(() => history.listen(dispatch), [history]);

    // Convert path based ids in user supplied initial loader/action data to data route ids
    let loaderData = convertRouteData(dataRoutes, initialLoaderData);
    let actionData = convertRouteData(dataRoutes, initialActionData);

    // Create mock remix context
    let remixContext = createRemixContext(
      dataRoutes,
      state.location,
      loaderData,
      actionData
    );

    // Patch fetch so that mock routes can handle action/loader requests
    monkeyPatchFetch(queryRoute, dataRoutes);

    return (
      <RemixEntry
        context={remixContext}
        action={state.action}
        location={state.location}
        navigator={history}
      />
    );
  };
}

function createRemixContext(
  routes: MockRouteObject[],
  currentLocation: Location,
  initialLoaderData?: RouteData,
  initialActionData?: RouteData
): EntryContext {
  let manifest = createManifest(routes);
  let matches = matchRoutes(routes, currentLocation) || [];

  return {
    actionData: initialActionData,
    appState: {
      trackBoundaries: true,
      trackCatchBoundaries: true,
      catchBoundaryRouteId: null,
      renderBoundaryRouteId: null,
      loaderBoundaryRouteId: null,
      error: undefined,
      catch: undefined,
    },
    matches: convertToEntryRouteMatch(matches),
    routeData: initialLoaderData || [],
    manifest: manifest,
    routeModules: createRouteModules(routes),
  };
}

function createManifest(routes: MockRouteObject[]): AssetsManifest {
  return {
    routes: createRouteManifest(routes),
    entry: { imports: [], module: "" },
    url: "",
    version: "",
  };
}

function createRouteManifest(
  routes: MockRouteObject[],
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
  routes: MockRouteObject[],
  routeModules?: RouteModules
): RouteModules {
  return routes.reduce((modules, route) => {
    if (route.children) {
      createRouteModules(route.children, modules);
    }

    if (typeof route.id === "undefined") {
      throw new Error("Route ID must be defined");
    }

    modules[route.id] = {
      CatchBoundary: route.CatchBoundary,
      ErrorBoundary: route.ErrorBoundary,
      default: () => <>{route.element}</>,
      handle: route.handle,
      links: route.links,
      meta: route.meta,
      unstable_shouldReload: route.unstable_shouldReload,
    };
    return modules;
  }, routeModules || {});
}

const originalFetch =
  typeof global !== "undefined" ? global.fetch : window.fetch;

function monkeyPatchFetch(
  queryRoute: StaticHandler["queryRoute"],
  dataRoutes: StaticHandler["dataRoutes"]
) {
  let fetchPatch = async (
    input: RequestInfo | URL,
    init: RequestInit = {}
  ): Promise<Response> => {
    let request = new Request(input, init);
    let url = new URL(request.url);

    // if we have matches, send the request to mock routes via @remix-run/router rather than the normal
    // @remix-run/server-runtime so that stubs can also be used in browser environments.
    let matches = matchRoutes(dataRoutes, url);
    if (matches && matchRoutes.length > 0) {
      let response = await queryRoute(request);

      if (response instanceof Response) {
        return response;
      }

      return json(response);
    }

    // if no matches, passthrough to the original fetch as mock routes couldn't handle the request.
    return originalFetch(request, init);
  };

  if (typeof global !== "undefined") {
    global.fetch = fetchPatch;
  } else {
    window.fetch = fetchPatch;
  }
}

function convertToEntryRoute(
  route: MockRouteObject,
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
    hasCatchBoundary: !!route.CatchBoundary,
    hasErrorBoundary: !!route.ErrorBoundary,
  };
}

function convertToEntryRouteMatch(
  routes: AgnosticRouteMatch<string, MockRouteObject>[]
) {
  return routes.map((match) => {
    return {
      params: match.params,
      pathname: match.pathname,
      route: convertToEntryRoute(match.route),
    };
  });
}

// Converts route data from a path based index to a route id index value.
// e.g. { "/post/:postId": post } to { "0": post }
function convertRouteData(
  routes: MockRouteObject[],
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
        if (typeof route.id === "undefined") {
          throw new Error("Route ID must be defined");
        }

        data[route.id] = initialRouteData[routePath];
      }
    });
    return data;
  }, routeData);
}
