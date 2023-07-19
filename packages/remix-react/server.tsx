import type { ReactElement } from "react";
import * as React from "react";
import {
  createStaticRouter,
  StaticRouterProvider,
} from "react-router-dom/server";

import { RemixContext } from "./components";
import type { EntryContext } from "./entry";
import {
  RemixErrorBoundary,
  RemixRootDefaultErrorBoundary,
} from "./errorBoundaries";
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

  let { manifest, routeModules, serverHandoffString } = context;
  let routes = createServerRoutes(
    manifest.routes,
    routeModules,
    context.future
  );
  let router = createStaticRouter(routes, context.staticHandlerContext);

  return (
    <RemixContext.Provider
      value={{
        manifest,
        routeModules,
        serverHandoffString,
        future: context.future,
        serializeError: context.serializeError,
        abortDelay,
      }}
    >
      <RemixErrorBoundary
        location={router.state.location}
        component={RemixRootDefaultErrorBoundary}
      >
        <StaticRouterProvider
          router={router}
          context={context.staticHandlerContext}
          hydrate={false}
        />
      </RemixErrorBoundary>
    </RemixContext.Provider>
  );
}
