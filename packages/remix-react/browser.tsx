import type { ReactElement } from "react";
import * as React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { RemixContext, RemixRoute } from "./components";
import type { EntryContext } from "./entry";
import type { RouteModules } from "./routeModules";
import { createClientRoutes } from "./routes";

/* eslint-disable prefer-let/prefer-let */
declare global {
  var __remixContext: EntryContext;
  var __remixRouteModules: RouteModules;
  var __remixManifest: EntryContext["manifest"];
}
/* eslint-enable prefer-let/prefer-let */

export interface RemixBrowserProps {}

const entryContext = window.__remixContext;
entryContext.manifest = window.__remixManifest;
entryContext.routeModules = window.__remixRouteModules;

const routes = createClientRoutes(
  entryContext.manifest.routes,
  entryContext.routeModules,
  RemixRoute
);
const router = createBrowserRouter(routes, {
  hydrationData: entryContext.staticHandlerContext,
});

/**
 * The entry point for a Remix app when it is rendered in the browser (in
 * `app/entry.client.js`). This component is used by React to hydrate the HTML
 * that was received from the server.
 */
export function RemixBrowser(_props: RemixBrowserProps): ReactElement {
  return (
    <RemixContext.Provider value={entryContext}>
      <RouterProvider router={router} fallbackElement={null} />
    </RemixContext.Provider>
  );
}
