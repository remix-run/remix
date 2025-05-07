import * as React from "react";
import {
  UNSAFE_convertRoutesToDataRoutes,
  type HydrationState,
  type InitialEntry,
  type Router,
  type ActionFunctionArgs as RRActionFunctionArgs,
  type LoaderFunctionArgs as RRLoaderFunctionArgs,
} from "@remix-run/router";
import { UNSAFE_RemixContext as RemixContext } from "@remix-run/react";
import type {
  UNSAFE_FutureConfig as FutureConfig,
  UNSAFE_AssetsManifest as AssetsManifest,
  UNSAFE_EntryRoute as EntryRoute,
  UNSAFE_RouteModules as RouteModules,
  UNSAFE_RemixContextObject as RemixContextObject,
  MetaFunction,
} from "@remix-run/react";
import type {
  DataRouteObject,
  IndexRouteObject,
  NonIndexRouteObject,
} from "react-router-dom";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import type {
  ActionFunction,
  AppLoadContext,
  LinksFunction,
  LoaderFunction,
} from "@remix-run/server-runtime";

interface StubIndexRouteObject
  extends Omit<
    IndexRouteObject,
    "loader" | "action" | "element" | "errorElement" | "children"
  > {
  loader?: LoaderFunction;
  action?: ActionFunction;
  children?: StubRouteObject[];
  meta?: MetaFunction;
  links?: LinksFunction;
}

interface StubNonIndexRouteObject
  extends Omit<
    NonIndexRouteObject,
    "loader" | "action" | "element" | "errorElement" | "children"
  > {
  loader?: LoaderFunction;
  action?: ActionFunction;
  children?: StubRouteObject[];
  meta?: MetaFunction;
  links?: LinksFunction;
}

type StubRouteObject = StubIndexRouteObject | StubNonIndexRouteObject;

export interface RemixStubProps {
  /**
   *  The initial entries in the history stack. This allows you to start a test with
   *  multiple locations already in the history stack (for testing a back navigation, etc.)
   *  The test will default to the last entry in initialEntries if no initialIndex is provided.
   *  e.g. initialEntries={["/home", "/about", "/contact"]}
   */
  initialEntries?: InitialEntry[];

  /**
   * The initial index in the history stack to render. This allows you to start a test at a specific entry.
   * It defaults to the last entry in initialEntries.
   * e.g.
   *   initialEntries: ["/", "/events/123"]
   *   initialIndex: 1 // start at "/events/123"
   */
  initialIndex?: number;

  /**
   *  Used to set the route's initial loader and action data.
   *  e.g. hydrationData={{
   *   loaderData: { "/contact": { locale: "en-US" } },
   *   actionData: { "/login": { errors: { email: "invalid email" } }}
   *  }}
   */
  hydrationData?: HydrationState;

  /**
   * Future flags mimicking the settings in remix.config.js
   */
  future?: Partial<FutureConfig>;
}

export function createRemixStub(
  routes: StubRouteObject[],
  context: AppLoadContext = {}
) {
  return function RemixStub({
    initialEntries,
    initialIndex,
    hydrationData,
    future,
  }: RemixStubProps) {
    let routerRef = React.useRef<Router>();
    let remixContextRef = React.useRef<RemixContextObject>();

    if (routerRef.current == null) {
      remixContextRef.current = {
        future: {
          v3_fetcherPersist: future?.v3_fetcherPersist === true,
          v3_relativeSplatPath: future?.v3_relativeSplatPath === true,
          v3_lazyRouteDiscovery: future?.v3_lazyRouteDiscovery === true,
          v3_singleFetch: future?.v3_singleFetch === true,
        },
        manifest: {
          routes: {},
          entry: { imports: [], module: "" },
          url: "",
          version: "",
        },
        routeModules: {},
        isSpaMode: false,
      };

      // Update the routes to include context in the loader/action and populate
      // the manifest and routeModules during the walk
      let patched = processRoutes(
        // @ts-expect-error loader/action context types don't match :/
        UNSAFE_convertRoutesToDataRoutes(routes, (r) => r),
        context,
        remixContextRef.current.manifest,
        remixContextRef.current.routeModules
      );
      routerRef.current = createMemoryRouter(patched, {
        initialEntries,
        initialIndex,
        hydrationData,
      });
    }

    return (
      <RemixContext.Provider value={remixContextRef.current}>
        <RouterProvider router={routerRef.current} />
      </RemixContext.Provider>
    );
  };
}

function processRoutes(
  routes: StubRouteObject[],
  context: AppLoadContext,
  manifest: AssetsManifest,
  routeModules: RouteModules,
  parentId?: string
): DataRouteObject[] {
  return routes.map((route) => {
    if (!route.id) {
      throw new Error(
        "Expected a route.id in @remix-run/testing processRoutes() function"
      );
    }

    // Patch in the Remix context to loaders/actions
    let { loader, action } = route;
    let newRoute: DataRouteObject = {
      id: route.id,
      path: route.path,
      index: route.index,
      Component: route.Component,
      ErrorBoundary: route.ErrorBoundary,
      action: action
        ? (args: RRActionFunctionArgs) => action!({ ...args, context })
        : undefined,
      loader: loader
        ? (args: RRLoaderFunctionArgs) => loader!({ ...args, context })
        : undefined,
      handle: route.handle,
      shouldRevalidate: route.shouldRevalidate,
    };

    // Add the EntryRoute to the manifest
    let entryRoute: EntryRoute = {
      id: route.id,
      path: route.path,
      index: route.index,
      parentId,
      hasAction: route.action != null,
      hasLoader: route.loader != null,
      // When testing routes, you should just be stubbing loader/action, not
      // trying to re-implement the full loader/clientLoader/SSR/hydration flow.
      // That is better tested via E2E tests.
      hasClientAction: false,
      hasClientLoader: false,
      hasErrorBoundary: route.ErrorBoundary != null,
      module: "build/stub-path-to-module.js", // any need for this?
    };
    manifest.routes[newRoute.id] = entryRoute;

    // Add the route to routeModules
    routeModules[route.id] = {
      default: route.Component || Outlet,
      ErrorBoundary: route.ErrorBoundary || undefined,
      handle: route.handle,
      links: route.links,
      meta: route.meta,
      shouldRevalidate: route.shouldRevalidate,
    };

    if (route.children) {
      newRoute.children = processRoutes(
        route.children,
        context,
        manifest,
        routeModules,
        newRoute.id
      );
    }

    return newRoute;
  });
}
