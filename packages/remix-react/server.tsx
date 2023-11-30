import type { ReactElement } from "react";
import * as React from "react";
import {
  createStaticRouter,
  StaticRouterProvider,
} from "react-router-dom/server";

import { RemixContext } from "./components";
import type { EntryContext } from "./entry";
import { RemixErrorBoundary } from "./errorBoundaries";
import { createServerRoutes } from "./routes";

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

  // Create a shallow clone of `loaderData` we can mutate for partial hydration.
  // When a route exports a `clientLoader` and a `HydrateFallback`, we want to
  // render the fallback on the server so we clear our the `loaderData` during SSR.
  // Is it important not to change the `context` reference here since we use it
  // for context._deepestRenderedBoundaryId tracking
  context.staticHandlerContext.loaderData = {
    ...context.staticHandlerContext.loaderData,
  };
  for (let match of context.staticHandlerContext.matches) {
    let routeId = match.route.id;
    let route = routeModules[routeId];
    if (route && route.clientLoader && route.HydrateFallback) {
      context.staticHandlerContext.loaderData[routeId] = undefined;
    }
  }

  let router = createStaticRouter(routes, context.staticHandlerContext, {
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
          context={context.staticHandlerContext}
          hydrate={false}
        />
      </RemixErrorBoundary>
    </RemixContext.Provider>
  );
}
