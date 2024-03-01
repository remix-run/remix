import type { ReactElement } from "react";
import * as React from "react";
import {
  createStaticRouter,
  StaticRouterProvider,
} from "react-router-dom/server";

import { RemixContext } from "./components";
import type { EntryContext } from "./entry";
import { RemixErrorBoundary } from "./errorBoundaries";
import { createServerRoutes, shouldHydrateRouteLoader } from "./routes";

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
    context.future,
    context.isSpaMode
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
    let manifestRoute = context.manifest.routes[routeId];
    // Clear out the loaderData to avoid rendering the route component when the
    // route opted into clientLoader hydration and either:
    // * gave us a HydrateFallback
    // * or doesn't have a server loader and we have no data to render
    if (
      route &&
      shouldHydrateRouteLoader(manifestRoute, route, context.isSpaMode) &&
      (route.HydrateFallback || !manifestRoute.hasLoader)
    ) {
      context.staticHandlerContext.loaderData[routeId] = undefined;
    }
  }

  let router = createStaticRouter(routes, context.staticHandlerContext, {
    future: {
      v7_partialHydration: true,
      v7_relativeSplatPath: context.future.v3_relativeSplatPath,
    },
  });

  return (
    <>
      <RemixContext.Provider
        value={{
          manifest,
          routeModules,
          criticalCss,
          serverHandoffString,
          future: context.future,
          isSpaMode: context.isSpaMode,
          serializeError: context.serializeError,
          abortDelay,
          renderMeta: context.renderMeta,
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
      {context.future.unstable_singleFetch && context.serverHandoffStream ? (
        <React.Suspense>
          <StreamTransfer
            context={context}
            identifier={0}
            reader={context.serverHandoffStream.getReader()}
            textDecoder={new TextDecoder()}
          />
        </React.Suspense>
      ) : null}
    </>
  );
}

export interface StreamTransferProps {
  context: EntryContext;
  identifier: number;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  textDecoder: TextDecoder;
}

// StreamTransfer recursively renders down chunks of the `serverHandoffStream`
// into the client-side `streamController`
function StreamTransfer({
  context,
  identifier,
  reader,
  textDecoder,
}: StreamTransferProps) {
  // If the user didn't render the <Scripts> component then we don't have to
  // bother streaming anything in
  if (!context.renderMeta?.didRenderScripts) {
    return null;
  }

  if (!context.renderMeta.streamCache) {
    context.renderMeta.streamCache = {};
  }
  let { streamCache } = context.renderMeta;
  let promise = streamCache[identifier];
  if (!promise) {
    promise = streamCache[identifier] = reader
      .read()
      .then((result) => {
        streamCache[identifier].result = {
          done: result.done,
          value: textDecoder.decode(result.value, { stream: true }),
        };
      })
      .catch((e) => {
        streamCache[identifier].error = e;
      });
  }

  if (promise.error) {
    throw promise.error;
  }
  if (promise.result === undefined) {
    throw promise;
  }

  let { done, value } = promise.result;
  let scriptTag = value ? (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__remixContext.streamController.enqueue(${JSON.stringify(
          value
        )});`,
      }}
    />
  ) : null;

  if (done) {
    return (
      <>
        {scriptTag}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__remixContext.streamController.close();`,
          }}
        />
      </>
    );
  } else {
    return (
      <>
        {scriptTag}
        <React.Suspense>
          <StreamTransfer
            context={context}
            identifier={identifier + 1}
            reader={reader}
            textDecoder={textDecoder}
          />
        </React.Suspense>
      </>
    );
  }
}
