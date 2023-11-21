import type { ReactElement } from "react";
import * as React from "react";
import {
  createStaticRouter,
  StaticRouterProvider,
} from "react-router-dom/server";

import { Links, Meta, RemixContext, Scripts } from "./components";
import type { EntryContext } from "./entry";
import { RemixErrorBoundary } from "./errorBoundaries";
import { createServerRoutes } from "./routes";
import { RemixRootDefaultFallback } from "./fallback";

export interface RemixServerProps {
  context: EntryContext;
  url: string | URL;
  abortDelay?: number;
}

/**
 * The entry point for a Remix app when it is rendered on the server (in
 * `app/entry.server.js`). This component is used to generate the HTML in the
 * response from the server.
 */
export function RemixServer({
  context,
  url,
  abortDelay,
}: RemixServerProps): ReactElement {
  if (typeof url === "string") {
    url = new URL(url);
  }

  let { manifest, routeModules, criticalCss, serverHandoffString } = context;
  let routes = createServerRoutes(
    manifest.routes,
    routeModules,
    context.future
  );

  // Create a shallow clone of loaderData we can mutate for partial hydration.
  // When a route has a clientLoader and a Fallback, then we clear out the
  // loaderData so that the router renders the Fallback during SSR
  let staticHandlerContext = {
    ...context.staticHandlerContext,
    loaderData: { ...context.staticHandlerContext.loaderData },
  };
  for (let match of context.staticHandlerContext.matches) {
    let routeId = match.route.id;
    let route = routeModules[routeId];
    if (route.clientLoader && route.Fallback) {
      staticHandlerContext.loaderData[routeId] = undefined;
    }
  }

  // TODO: Is there a case we need to warn/error here for root?

  let router = createStaticRouter(routes, staticHandlerContext, {
    future: {
      v7_partialHydration: true,
    },
  });

  return (
    <RemixContext.Provider
      value={{
        manifest,
        routeModules,
        criticalCss,
        serverHandoffString,
        future: context.future,
        serializeError: context.serializeError,
        abortDelay,
      }}
    >
      <RemixErrorBoundary location={router.state.location}>
        <StaticRouterProvider
          router={router}
          context={staticHandlerContext}
          hydrate={false}
        />
      </RemixErrorBoundary>
    </RemixContext.Provider>
  );
}
