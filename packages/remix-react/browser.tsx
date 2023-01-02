import type { HydrationState, Router } from "@remix-run/router";
import type { ReactElement } from "react";
import * as React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { RemixContext } from "./components";
import type { EntryContext, FutureConfig } from "./entry";
import { deserializeErrors } from "./errors";
import type { RouteModules } from "./routeModules";
import { createClientRoutes } from "./routes";

/* eslint-disable prefer-let/prefer-let */
declare global {
  var __remixContext: {
    state: HydrationState;
    future: FutureConfig;
  };
  var __remixRouteModules: RouteModules;
  var __remixManifest: EntryContext["manifest"];
}
/* eslint-enable prefer-let/prefer-let */

export interface RemixBrowserProps {}

let router: Router;

/**
 * The entry point for a Remix app when it is rendered in the browser (in
 * `app/entry.client.js`). This component is used by React to hydrate the HTML
 * that was received from the server.
 */
export function RemixBrowser(_props: RemixBrowserProps): ReactElement {
  if (!router) {
    let routes = createClientRoutes(
      window.__remixManifest.routes,
      window.__remixRouteModules
    );

    let hydrationData = window.__remixContext.state;
    if (hydrationData && hydrationData.errors) {
      hydrationData = {
        ...hydrationData,
        errors: deserializeErrors(hydrationData.errors),
      };
    }

    router = createBrowserRouter(routes, { hydrationData });
  }

  return (
    <RemixContext.Provider
      value={{
        manifest: window.__remixManifest,
        routeModules: window.__remixRouteModules,
        future: window.__remixContext.future,
      }}
    >
      <RouterProvider router={router} fallbackElement={null} />
    </RemixContext.Provider>
  );
}
