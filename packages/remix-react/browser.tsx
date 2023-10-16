import type { HydrationState, Router } from "@remix-run/router";
import type { ReactElement } from "react";
import * as React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { RemixContext } from "./components";
import type { EntryContext, FutureConfig } from "./entry";
import { RemixErrorBoundary } from "./errorBoundaries";
import { deserializeErrors } from "./errors";
import type { RouteModules } from "./routeModules";
import {
  createClientRoutes,
  createClientRoutesWithHMRRevalidationOptOut,
} from "./routes";

/* eslint-disable prefer-let/prefer-let */
declare global {
  var __remixContext: {
    url: string;
    state: HydrationState;
    criticalCss?: string;
    future: FutureConfig;
    // The number of active deferred keys rendered on the server
    a?: number;
    dev?: {
      port?: number;
      hmrRuntime?: string;
    };
  };
  var __remixRouter: Router;
  var __remixRouteModules: RouteModules;
  var __remixManifest: EntryContext["manifest"];
  var __remixRevalidation: number | undefined;
  var __remixClearCriticalCss: () => void;
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
let hmrAbortController: AbortController | undefined;
let hmrRouterReadyResolve: ((router: Router) => void) | undefined;
// There's a race condition with HMR where the remix:manifest is signaled before
// the router is assigned in the RemixBrowser component. This promise gates the
// HMR handler until the router is ready
let hmrRouterReadyPromise = new Promise<Router>((resolve) => {
  // body of a promise is executed immediately, so this can be resolved outside
  // of the promise body
  hmrRouterReadyResolve = resolve;
}).catch(() => {
  // This is a noop catch handler to avoid unhandled promise rejection warnings
  // in the console. The promise is never rejected.
  return undefined;
});

type CriticalCssReducer = () => typeof window.__remixContext.criticalCss;
// The critical CSS can only be cleared, so the reducer always returns undefined
let criticalCssReducer: CriticalCssReducer = () => undefined;

if (import.meta && import.meta.hot) {
  import.meta.hot.accept(
    "remix:manifest",
    async ({
      assetsManifest,
      needsRevalidation,
    }: {
      assetsManifest: EntryContext["manifest"];
      needsRevalidation: Set<string>;
    }) => {
      let router = await hmrRouterReadyPromise;
      // This should never happen, but just in case...
      if (!router) {
        console.error(
          "Failed to accept HMR update because the router was not ready."
        );
        return;
      }

      let routeIds = [
        ...new Set(
          router.state.matches
            .map((m) => m.route.id)
            .concat(Object.keys(window.__remixRouteModules))
        ),
      ];

      if (hmrAbortController) {
        hmrAbortController.abort();
      }
      hmrAbortController = new AbortController();
      let signal = hmrAbortController.signal;

      // Load new route modules that we've seen.
      let newRouteModules = Object.assign(
        {},
        window.__remixRouteModules,
        Object.fromEntries(
          (
            await Promise.all(
              routeIds.map(async (id) => {
                if (!assetsManifest.routes[id]) {
                  return null;
                }
                let imported = await import(
                  assetsManifest.routes[id].module +
                    `?t=${assetsManifest.hmr?.timestamp}`
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
      let routes = createClientRoutesWithHMRRevalidationOptOut(
        needsRevalidation,
        assetsManifest.routes,
        window.__remixRouteModules,
        window.__remixContext.future
      );

      // This is temporary API and will be more granular before release
      router._internalSetRoutes(routes);

      // Wait for router to be idle before updating the manifest and route modules
      // and triggering a react-refresh
      let unsub = router.subscribe((state) => {
        if (state.revalidation === "idle") {
          unsub();
          // Abort if a new update comes in while we're waiting for the
          // router to be idle.
          if (signal.aborted) return;
          // Ensure RouterProvider setState has flushed before re-rendering
          setTimeout(() => {
            Object.assign(window.__remixManifest, assetsManifest);
            window.$RefreshRuntime$.performReactRefresh();
          }, 1);
        }
      });
      window.__remixRevalidation = (window.__remixRevalidation || 0) + 1;
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
    // Hard reload if the path we tried to load is not the current path.
    // This is usually the result of 2 rapid back/forward clicks from an
    // external site into a Remix app, where we initially start the load for
    // one URL and while the JS chunks are loading a second forward click moves
    // us to a new URL.  Avoid comparing search params because of CDNs which
    // can be configured to ignore certain params and only pathname is relevant
    // towards determining the route matches.
    let initialPathname = window.__remixContext.url;
    let hydratedPathname = window.location.pathname;
    if (initialPathname !== hydratedPathname) {
      let errorMsg =
        `Initial URL (${initialPathname}) does not match URL at time of hydration ` +
        `(${hydratedPathname}), reloading page...`;
      console.error(errorMsg);
      window.location.reload();
      // Get out of here so the reload can happen - don't create the router
      // since it'll then kick off unnecessary route.lazy() loads
      return <></>;
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

    router = createBrowserRouter(routes, {
      hydrationData,
      future: {
        v7_normalizeFormMethod: true,
      },
    });
    // @ts-ignore
    router.createRoutesForHMR = createClientRoutesWithHMRRevalidationOptOut;
    window.__remixRouter = router;

    // Notify that the router is ready for HMR
    if (hmrRouterReadyResolve) {
      hmrRouterReadyResolve(router);
    }
  }

  // Critical CSS can become stale after code changes, e.g. styles might be
  // removed from a component, but the styles will still be present in the
  // server HTML. This allows our HMR logic to clear the critical CSS state.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  let [criticalCss, clearCriticalCss] = React.useReducer(
    criticalCssReducer,
    window.__remixContext.criticalCss
  );
  window.__remixClearCriticalCss = clearCriticalCss;

  // This is due to the shit circuit return above which is an exceptional
  // scenario which we can't hydrate anyway
  // eslint-disable-next-line react-hooks/rules-of-hooks
  let [location, setLocation] = React.useState(router.state.location);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useLayoutEffect(() => {
    return router.subscribe((newState) => {
      if (newState.location !== location) {
        setLocation(newState.location);
      }
    });
  }, [location]);

  // We need to include a wrapper RemixErrorBoundary here in case the root error
  // boundary also throws and we need to bubble up outside of the router entirely.
  // Then we need a stateful location here so the user can back-button navigate
  // out of there
  return (
    <RemixContext.Provider
      value={{
        manifest: window.__remixManifest,
        routeModules: window.__remixRouteModules,
        future: window.__remixContext.future,
        criticalCss,
      }}
    >
      <RemixErrorBoundary location={location}>
        <RouterProvider
          router={router}
          fallbackElement={null}
          future={{ v7_startTransition: true }}
        />
      </RemixErrorBoundary>
    </RemixContext.Provider>
  );
}
