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
import { warnOnce } from "./warnings";

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
  var $RefreshRuntime$: {
    performReactRefresh: () => void;
  };
}
/* eslint-enable prefer-let/prefer-let */

export interface RemixBrowserProps {}

declare global {
  interface ImportMeta {
    hot: any;
  }
}

let router: Router;
let hmrAbortController: AbortController;

if (import.meta && import.meta.hot) {
  import.meta.hot.accept(
    "remix:manifest",
    async (newManifest: EntryContext["manifest"]) => {
      let routeIds = [
        ...new Set(
          router.state.matches
            .map((m) => m.route.id)
            .concat(Object.keys(window.__remixRouteModules))
        ),
      ];

      // Load new route modules that we've seen.
      let newRouteModules = Object.assign(
        {},
        window.__remixRouteModules,
        Object.fromEntries(
          (
            await Promise.all(
              routeIds.map(async (id) => {
                if (!newManifest.routes[id]) {
                  return null;
                }
                let imported = await import(
                  newManifest.routes[id].module +
                    `?t=${newManifest.hmr?.timestamp}`
                );
                return [
                  id,
                  {
                    ...imported,
                    // react-refresh takes care of updating these in-place,
                    // if we don't preserve existing values we'll loose state.
                    default: imported.default
                      ? window.__remixRouteModules[id]?.default ??
                        imported.default
                      : imported.default,
                    CatchBoundary: imported.CatchBoundary
                      ? window.__remixRouteModules[id]?.CatchBoundary ??
                        imported.CatchBoundary
                      : imported.CatchBoundary,
                    ErrorBoundary: imported.ErrorBoundary
                      ? window.__remixRouteModules[id]?.ErrorBoundary ??
                        imported.ErrorBoundary
                      : imported.ErrorBoundary,
                  },
                ];
              })
            )
          ).filter(Boolean) as [string, RouteModules[string]][]
        )
      );

      Object.assign(window.__remixRouteModules, newRouteModules);
      // Create new routes
      let routes = createClientRoutes(
        newManifest.routes,
        window.__remixRouteModules,
        window.__remixContext.future
      );

      // This is temporary API and will be more granular before release
      router._internalSetRoutes(routes);

      if (hmrAbortController) {
        hmrAbortController.abort();
      }
      hmrAbortController = new AbortController();
      let signal = hmrAbortController.signal;
      // Wait for router to be idle before updating the manifest and route modules
      // and triggering a react-refresh
      let unsub = router.subscribe((state) => {
        if (state.revalidation === "idle" && !signal.aborted) {
          unsub();
          // TODO: Handle race conditions here. Should abort if a new update
          // comes in while we're waiting for the router to be idle.
          Object.assign(window.__remixManifest, newManifest);
          window.$RefreshRuntime$.performReactRefresh();
        }
      });
      router.revalidate();
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
    if (!window.__remixContext.future.v2_errorBoundary) {
      warnOnce(
        false,
        "⚠️  DEPRECATED: The separation of `CatchBoundary` and `ErrorBoundary` has " +
          "been deprecated and Remix v2 will use a singular `ErrorBoundary` for " +
          "all thrown values (`Response` and `Error`). Please migrate to the new " +
          "behavior in Remix v1 via the `future.v2_errorBoundary` flag in your " +
          "`remix.config.js` file. For more information, see " +
          "https://remix.run/docs/route/error-boundary-v2"
      );
    }

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
