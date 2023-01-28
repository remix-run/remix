import type { HydrationState, Router } from "@remix-run/router";
import type { ReactElement } from "react";
import * as React from "react";
import type { Location } from "react-router-dom";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useSyncExternalStore } from "use-sync-external-store/shim";

import { RemixContext } from "./components";
import type { EntryContext, FutureConfig } from "./entry";
import {
  RemixErrorBoundary,
  RemixRootDefaultErrorBoundary,
} from "./errorBoundaries";
import { deserializeErrors } from "./errors";
import type { RouteModules } from "./routeModules";
import { createClientRoutes } from "./routes";

/* eslint-disable prefer-let/prefer-let */
declare global {
  var __remixContext: {
    state: HydrationState;
    future: FutureConfig;
    // The number of active deferred keys rendered on the server
    a?: number;
    dev?: {
      liveReloadPort?: number;
      hmrRuntime?: string;
    };
  };
  var __remixRouteModules: RouteModules;
  var __remixManifest: EntryContext["manifest"];
}
/* eslint-enable prefer-let/prefer-let */

export interface RemixBrowserProps {}

declare global {
  interface ImportMeta {
    hot: any;
  }
}

let router: Router;

if (import.meta && import.meta.hot) {
  import.meta.hot.accept(
    "remix:manifest",
    async (newManifest: EntryContext["manifest"]) => {
      let routeModules = Object.fromEntries(
        (
          await Promise.all(
            Object.entries(__remixRouteModules).map(async ([key, value]) => {
              if (!newManifest.routes[key]) {
                return null;
              }

              let imported = await import(newManifest.routes[key].module);
              return [
                key,
                {
                  ...imported,
                  default:
                    window.__remixRouteModules[key].default || imported.default,
                  CatchBoundary:
                    window.__remixRouteModules[key].CatchBoundary ||
                    imported.CatchBoundary,
                  ErrorBoundary:
                    window.__remixRouteModules[key].ErrorBoundary ||
                    imported.ErrorBoundary,
                },
              ];
            })
          )
        ).filter(Boolean) as [string, RouteModules[string]][]
      );

      let routes = createClientRoutes(
        newManifest.routes,
        routeModules,
        window.__remixContext.future
      );

      let donePromise = new Promise<void>((resolve) => {
        let unsub = router.subscribe((state) => {
          if (state.revalidation === "idle") {
            unsub();
            resolve();
          }
        });
      });

      Object.assign(window.__remixManifest, newManifest);
      Object.assign(window.__remixRouteModules, routeModules);
      router.setNewRoutes(routes);
      await donePromise;

      window.$RefreshRuntime$.performReactRefresh();
    }
  );
}

/**
 * The entry point for a Remix app when it is rendered in the browser (in
 * `app/entry.client.js`). This component is used by React to hydrate the HTML
 * that was received from the server.
 */
export function RemixBrowser(_props: RemixBrowserProps): ReactElement {
  if (!router) {
    let routes = createClientRoutes(
      window.__remixManifest.routes,
      window.__remixRouteModules,
      window.__remixContext.future
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

  // We need to include a wrapper RemixErrorBoundary here in case the root error
  // boundary also throws and we need to bubble up outside of the router entirely.
  // Then we need a stateful location here so the user can back-button navigate
  // out of there
  let location: Location = useSyncExternalStore(
    router.subscribe,
    () => router.state.location,
    () => router.state.location
  );

  return (
    <RemixContext.Provider
      value={{
        manifest: window.__remixManifest,
        routeModules: window.__remixRouteModules,
        future: window.__remixContext.future,
      }}
    >
      <RemixErrorBoundary
        location={location}
        component={RemixRootDefaultErrorBoundary}
      >
        <RouterProvider router={router} fallbackElement={null} />
      </RemixErrorBoundary>
    </RemixContext.Provider>
  );
}
