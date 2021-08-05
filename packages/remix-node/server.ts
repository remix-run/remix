import type { AppLoadContext, Timings } from "./data";
import {
  loadRouteData,
  callRouteAction,
  timer,
  getServerTimeHeader
} from "./data";
import type { ComponentDidCatchEmulator } from "./errors";

import { serializeError } from "./errors";
import type { ServerBuild } from "./build";
import type { EntryContext } from "./entry";
import { createEntryMatches, createEntryRouteModules } from "./entry";
import { Response, Request } from "./fetch";
import { getDocumentHeaders } from "./headers";
import type { RouteMatch } from "./routeMatching";
import { matchServerRoutes } from "./routeMatching";
import { ServerMode, isServerMode } from "./mode";
import type { ServerRoute } from "./routes";
import { createRoutes } from "./routes";
import { createActionData, createRouteData } from "./routeData";
import { json } from "./responses";
import { createServerHandoffString } from "./serverHandoff";
import { RequestInit } from "node-fetch";

/**
 * The main request handler for a Remix server. This handler runs in the context
 * of a cloud provider's server (e.g. Express on Firebase) or locally via their
 * dev tools.
 */
export interface RequestHandler {
  (request: Request, loadContext?: AppLoadContext): Promise<Response>;
}

/**
 * Creates a function that serves HTTP requests.
 */
export function createRequestHandler({
  build,
  mode,
  serverTiming // TODO: Use this to enable/disable Server-Timing headers
}: {
  build: ServerBuild;
  mode?: string;
  serverTiming?: boolean;
}): RequestHandler {
  let routes = createRoutes(build.routes);
  let serverMode = isServerMode(mode) ? mode : ServerMode.Production;

  return (request, loadContext = {}) =>
    isDataRequest(request)
      ? handleDataRequest(request, loadContext, build, routes)
      : handleDocumentRequest(request, loadContext, build, routes, serverMode);
}

async function handleDataRequest(
  request: Request,
  loadContext: AppLoadContext,
  build: ServerBuild,
  routes: ServerRoute[]
): Promise<Response> {
  let url = new URL(request.url);
  const timings: Timings = {};

  let matches = matchServerRoutes(routes, url.pathname);
  if (!matches) {
    return jsonError(`No route matches URL "${url.pathname}"`, 404);
  }

  let routeMatch: RouteMatch<ServerRoute>;
  let isAction = isActionRequest(request);

  if (isAction) {
    routeMatch = matches[matches.length - 1];
  } else {
    let routeId = url.searchParams.get("_data");
    if (!routeId) {
      return jsonError(`Missing route id in ?_data`, 403);
    }

    let match = matches.find(match => match.route.id === routeId);
    if (!match) {
      return jsonError(
        `Route "${routeId}" does not match URL "${url.pathname}"`,
        403
      );
    }

    routeMatch = match;
  }

  let clonedRequest = await stripDataParam(request);

  let response: Response;

  function timeTiedToTiming<R>(
    args: Omit<Parameters<typeof timer>[0], "timings">
  ) {
    return timer<R>({
      name: args.name,
      type: args.type,
      timings,
      fn: args.fn as () => Promise<R>
    });
  }

  try {
    if (isAction) {
      response = await timer({
        name: `action.${routeMatch.route.id}`,
        type: "action",
        timings,
        fn: () =>
          callRouteAction(
            build,
            routeMatch.route.id,
            clonedRequest,
            loadContext,
            routeMatch.params,
            timeTiedToTiming
          )
      });
    } else {
      response = await timer({
        name: `loader.${routeMatch.route.id}`,
        type: "loader",
        timings,
        fn: () =>
          loadRouteData(
            build,
            routeMatch.route.id,
            clonedRequest,
            loadContext,
            routeMatch.params,
            timeTiedToTiming
          )
      });
    }
  } catch (error: unknown) {
    return json(serializeError(error as Error), {
      status: 500,
      headers: {
        "X-Remix-Error": "unfortunately, yes",
        "Server-Timing": getServerTimeHeader(timings)
      }
    });
  }

  response.headers.append("Server-Timing", getServerTimeHeader(timings));

  if (isRedirectResponse(response)) {
    // We don't have any way to prevent a fetch request from following
    // redirects. So we use the `X-Remix-Redirect` header to indicate the
    // next URL, and then "follow" the redirect manually on the client.
    let locationHeader = response.headers.get("Location");
    response.headers.delete("Location");
    response.headers.append("X-Remix-Redirect", locationHeader!);

    return new Response("", {
      status: 204,
      headers: response.headers
    });
  }

  return response;
}

async function handleDocumentRequest(
  request: Request,
  loadContext: AppLoadContext,
  build: ServerBuild,
  routes: ServerRoute[],
  serverMode: ServerMode
): Promise<Response> {
  let url = new URL(request.url);
  const timings: Timings = {};

  function timeTiedToTiming<R>(
    args: Omit<Parameters<typeof timer>[0], "timings">
  ) {
    return timer<R>({
      name: args.name,
      type: args.type,
      timings,
      fn: args.fn as () => Promise<R>
    });
  }

  let matches = matchServerRoutes(routes, url.pathname);
  if (!matches) {
    // TODO: Provide a default 404 page
    throw new Error(
      `There is no route that matches ${url.pathname}. Please add ` +
        `a routes/404.js file`
    );
  }

  let componentDidCatchEmulator: ComponentDidCatchEmulator = {
    trackBoundaries: true,
    renderBoundaryRouteId: null,
    loaderBoundaryRouteId: null,
    error: undefined
  };

  let actionErrored: boolean = false;
  let actionResponse: Response | undefined;

  if (isActionRequest(request)) {
    let leafMatch = matches[matches.length - 1];
    try {
      actionResponse = await timer({
        name: `action.${leafMatch.route.id}`,
        type: "action",
        timings,
        fn: () =>
          callRouteAction(
            build,
            leafMatch.route.id,
            request.clone(),
            loadContext,
            leafMatch.params,
            timeTiedToTiming
          )
      });

      if (isRedirectResponse(actionResponse)) {
        actionResponse.headers.append(
          "Server-Timing",
          getServerTimeHeader(timings)
        );
        return actionResponse;
      }
    } catch (error) {
      actionErrored = true;
      let withBoundaries = getMatchesUpToDeepestErrorBoundary(matches);
      componentDidCatchEmulator.loaderBoundaryRouteId =
        withBoundaries[withBoundaries.length - 1].route.id;
      componentDidCatchEmulator.error = serializeError(error);
    }
  }

  let matchesToLoad = actionErrored
    ? getMatchesUpToDeepestErrorBoundary(
        // get rid of the action, we don't want to call it's loader either
        // because we'll be rendering the error boundary, if you can get access
        // to the loader data in the error boundary then how the heck is it
        // supposed to deal with errors in the loader, too?
        matches.slice(0, -1)
      )
    : matches;

  // Run all data loaders in parallel. Await them in series below.  Note: This
  // code is a little weird due to the way unhandled promise rejections are
  // handled in node. We use a .catch() handler on each promise to avoid the
  // warning, then handle errors manually afterwards.
  let routeLoaderPromises: Promise<Response | Error>[] = matchesToLoad.map(
    match =>
      timer({
        name: `loader.${match.route.id}`,
        type: "loader",
        timings,
        fn: () =>
          loadRouteData(
            build,
            match.route.id,
            request.clone(),
            loadContext,
            match.params,
            timeTiedToTiming
          ).catch(error => error)
      })
  );

  let routeLoaderResults = await Promise.all(routeLoaderPromises);
  for (let [index, response] of routeLoaderResults.entries()) {
    let route = matches[index].route;
    let routeModule = build.routes[route.id].module;

    // Rare case where an action throws an error, and then when we try to render
    // the action's page to tell the user about the the error, a loader above
    // the action route *also* threw an error or tried to redirect!
    //
    // Instead of rendering the loader error or redirecting like usual, we
    // ignore the loader error or redirect because the action error was first
    // and is higher priority to surface.  Perhaps the action error is the
    // reason the loader blows up now! It happened first and is more important
    // to address.
    //
    // We just give up and move on with rendering the error as deeply as we can,
    // which is the previous iteration of this loop
    if (
      actionErrored &&
      (response instanceof Error || isRedirectResponse(response))
    ) {
      break;
    }

    if (componentDidCatchEmulator.error) {
      continue;
    }

    if (routeModule.ErrorBoundary) {
      componentDidCatchEmulator.loaderBoundaryRouteId = route.id;
    }

    if (response instanceof Error) {
      if (serverMode !== ServerMode.Test) {
        console.error(
          `There was an error running the data loader for route ${route.id}`
        );
      }

      componentDidCatchEmulator.error = serializeError(response);
      routeLoaderResults[index] = json(null, { status: 500 });
    } else if (isRedirectResponse(response)) {
      response.headers.append("Server-Timing", getServerTimeHeader(timings));
      return response;
    }
  }

  // We already filtered out all Errors, so these are all Responses.
  let routeLoaderResponses: Response[] = routeLoaderResults as Response[];

  // Handle responses with a non-200 status code. The first loader with a
  // non-200 status code determines the status code for the whole response.
  let notOkResponse = routeLoaderResponses.find(
    response => response.status !== 200
  );

  let statusCode = actionErrored
    ? 500
    : notOkResponse
    ? notOkResponse.status
    : matches[matches.length - 1].route.id === "routes/404"
    ? 404
    : 200;

  let renderableMatches = getRenderableMatches(
    matches,
    componentDidCatchEmulator
  );
  let serverEntryModule = build.entry.module;
  let headers = getDocumentHeaders(
    build,
    renderableMatches,
    routeLoaderResponses,
    actionResponse
  );
  headers.append("Server-Timing", getServerTimeHeader(timings));
  let entryMatches = createEntryMatches(renderableMatches, build.assets.routes);
  let routeData = await createRouteData(
    renderableMatches,
    routeLoaderResponses
  );
  let actionData = actionResponse
    ? await createActionData(actionResponse)
    : undefined;
  let routeModules = createEntryRouteModules(build.routes);
  let serverHandoff = {
    matches: entryMatches,
    componentDidCatchEmulator,
    routeData,
    actionData
  };
  let entryContext: EntryContext = {
    ...serverHandoff,
    manifest: build.assets,
    routeModules,
    serverHandoffString: createServerHandoffString(serverHandoff)
  };

  let response: Response | Promise<Response>;
  try {
    response = serverEntryModule.default(
      request,
      statusCode,
      headers,
      entryContext
    );
  } catch (error) {
    if (serverMode !== ServerMode.Test) {
      console.error(error);
    }

    statusCode = 500;

    // Go again, this time with the componentDidCatch emulation. As it rendered
    // last time we mutated `componentDidCatch.routeId` for the last rendered
    // route, now we know where to render the error boundary (feels a little
    // hacky but that's how hooks work). This tells the emulator to stop
    // tracking the `routeId` as we render because we already have an error to
    // render.
    componentDidCatchEmulator.trackBoundaries = false;
    componentDidCatchEmulator.error = serializeError(error);
    entryContext.serverHandoffString = createServerHandoffString(serverHandoff);

    try {
      response = serverEntryModule.default(
        request,
        statusCode,
        headers,
        entryContext
      );
    } catch (error) {
      if (serverMode !== ServerMode.Test) {
        console.error(error);
      }

      // Good grief folks, get your act together 😂!
      response = new Response(`Unexpected Server Error\n\n${error.message}`, {
        status: 500,
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }
  }

  return response;
}

function jsonError(error: string, status = 403): Response {
  return json({ error }, { status });
}

function isActionRequest(request: Request): boolean {
  return request.method.toLowerCase() !== "get";
}

function isDataRequest(request: Request): boolean {
  return new URL(request.url).searchParams.has("_data");
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);

function isRedirectResponse(response: Response): boolean {
  return redirectStatusCodes.has(response.status);
}

async function stripDataParam(og: Request) {
  let url = new URL(og.url);
  url.searchParams.delete("_data");
  let init: RequestInit = {
    method: og.method,
    headers: og.headers
  };
  if (og.method.toLowerCase() !== "get") {
    init.body = await og.text();
  }
  return new Request(url, init);
}

// This ensures we only load the data for the routes above an action error
function getMatchesUpToDeepestErrorBoundary(
  matches: RouteMatch<ServerRoute>[]
) {
  let deepestErrorBoundaryIndex: number = -1;

  matches.forEach((match, index) => {
    if (match.route.module.ErrorBoundary) {
      deepestErrorBoundaryIndex = index;
    }
  });

  if (deepestErrorBoundaryIndex === -1) {
    // no route error boundaries, don't need to call any loaders
    return [];
  }

  return matches.slice(0, deepestErrorBoundaryIndex + 1);
}

// This prevents `<Outlet/>` from rendering anything below where the error threw
// TODO: maybe do this in <RemixErrorBoundary + context>
function getRenderableMatches(
  matches: RouteMatch<ServerRoute>[],
  componentDidCatchEmulator: ComponentDidCatchEmulator
) {
  // no error, no worries
  if (!componentDidCatchEmulator.error) {
    return matches;
  }

  let lastRenderableIndex: number = -1;

  matches.forEach((match, index) => {
    let id = match.route.id;
    if (
      componentDidCatchEmulator.renderBoundaryRouteId === id ||
      componentDidCatchEmulator.loaderBoundaryRouteId === id
    ) {
      lastRenderableIndex = index;
    }
  });

  return matches.slice(0, lastRenderableIndex + 1);
}
