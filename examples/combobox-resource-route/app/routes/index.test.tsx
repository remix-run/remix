import type { RouteModule } from "@remix-run/react/routeModules";
import type { DataFunctionArgs } from "@remix-run/server-runtime";
import {
  render as rtlRender,
  RenderOptions,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionFunction, LoaderFunction, RemixBrowser } from "remix";

import * as Route from "./index";

async function renderRoute(
  route: RouteModule & { loader?: LoaderFunction; action?: ActionFunction },
  {
    request = new Request("/"),
    context = null,
    params = {},
    ...options
  }: RenderOptions & Partial<DataFunctionArgs> = {}
) {
  window.__remixManifest = {
    routes: {
      root: {
        hasAction: Boolean(route.action),
        hasCatchBoundary: Boolean(route.CatchBoundary),
        hasErrorBoundary: Boolean(route.ErrorBoundary),
        hasLoader: Boolean(route.loader),
        id: "root",
        imports: [],
        module: "",
        path: "",
      },
    },
    entry: { imports: [], module: "" },
    url: "",
    version: "",
  };
  window.__remixRouteModules = { root: route };
  window.__remixContext = {
    matches: [],
    manifest: window.__remixManifest,
    routeModules: window.__remixRouteModules,
    actionData: undefined,
    routeData: {
      root: route.loader
        ? await route.loader({ request, context, params })
        : null,
    },
    appState: {
      catchBoundaryRouteId: null,
      loaderBoundaryRouteId: null,
      renderBoundaryRouteId: "root",
      trackBoundaries: false,
      trackCatchBoundaries: false,
    },
  };

  return rtlRender(<RemixBrowser />, options);
}

test("thing", () => {
  renderRoute(Route);
  screen.debug();
});
