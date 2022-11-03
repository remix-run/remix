// TODO: RRR - Change import to @remix-run/router
import type { StaticHandler } from "./router";
import { unstable_createStaticHandler } from "./router";
import type { AppLoadContext } from "./data";
import { callRouteAction, callRouteLoader, extractData } from "./data";
import type { AppState } from "./errors";
import type { ServerBuild } from "./build";
import type { EntryContext } from "./entry";
import { createEntryMatches, createEntryRouteModules } from "./entry";
import { serializeError } from "./errors";
import { getDocumentHeaders } from "./headers";
import invariant from "./invariant";
import { ServerMode, isServerMode } from "./mode";
import type { RouteMatch } from "./routeMatching";
import { matchServerRoutes } from "./routeMatching";
import type { ServerRoute } from "./routes";
import { createStaticHandlerDataRoutes, createRoutes } from "./routes";
import { json, isRedirectResponse, isCatchResponse } from "./responses";
import { createServerHandoffString } from "./serverHandoff";

export type RequestHandler = (
  request: Request,
  loadContext?: AppLoadContext
) => Promise<Response>;

export type CreateRequestHandlerFunction = (
  build: ServerBuild,
  mode?: string
) => RequestHandler;

// This can be toggled to true for experimental releases
const ENABLE_REMIX_ROUTER = process.env.ENABLE_REMIX_ROUTER;

export const createRequestHandler: CreateRequestHandlerFunction = (
  build,
  mode
) => {
  let routes = createRoutes(build.routes);
  let serverMode = isServerMode(mode) ? mode : ServerMode.Production;

  return async function requestHandler(request, loadContext = {}) {
    let url = new URL(request.url);
    let matches = matchServerRoutes(routes, url.pathname);

    let staticHandler: StaticHandler;
    if (ENABLE_REMIX_ROUTER) {
      staticHandler = unstable_createStaticHandler(
        createStaticHandlerDataRoutes(build.routes, loadContext)
      );
    }

    let response: Response;
    if (url.searchParams.has("_data")) {
      let responsePromise = handleDataRequest({
        request:
          // We need to clone the request here instead of the call to the new
          // handler otherwise the first handler will lock the body for the other.
          // Cloning here allows the new handler to be the stream reader and delegate
          // chunks back to this cloned request.
          ENABLE_REMIX_ROUTER ? request.clone() : request,
        loadContext,
        matches: matches!,
        serverMode,
      });

      let routeId = url.searchParams.get("_data")!;
      if (ENABLE_REMIX_ROUTER) {
        let [response, remixRouterResponse] = await Promise.all([
          responsePromise,
          handleDataRequestRR(serverMode, staticHandler!, routeId, request),
        ]);

        assertResponsesMatch(response, remixRouterResponse);

        console.log("Returning Remix Router Data Request Response");
        responsePromise = Promise.resolve(remixRouterResponse);
      }

      response = await responsePromise;

      if (build.entry.module.handleDataRequest) {
        let match = matches!.find((match) => match.route.id == routeId)!;
        response = await build.entry.module.handleDataRequest(response, {
          context: loadContext,
          params: match.params,
          request,
        });
      }
    } else if (
      matches &&
      matches[matches.length - 1].route.module.default == null
    ) {
      let responsePromise = handleResourceRequest({
        request:
          // We need to clone the request here instead of the call to the new
          // handler otherwise the first handler will lock the body for the other.
          // Cloning here allows the new handler to be the stream reader and delegate
          // chunks back to this cloned request.
          ENABLE_REMIX_ROUTER ? request.clone() : request,
        loadContext,
        matches,
        serverMode,
      });

      if (ENABLE_REMIX_ROUTER) {
        let [response, remixRouterResponse] = await Promise.all([
          responsePromise,
          handleResourceRequestRR(
            serverMode,
            staticHandler!,
            matches.slice(-1)[0].route.id,
            request
          ),
        ]);

        assertResponsesMatch(response, remixRouterResponse);

        console.log("Returning Remix Router Resource Request Response");
        responsePromise = Promise.resolve(remixRouterResponse);
      }

      response = await responsePromise;
    } else {
      response = await handleDocumentRequest({
        build,
        loadContext,
        matches,
        request,
        routes,
        serverMode,
      });
    }

    if (request.method === "HEAD") {
      return new Response(null, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      });
    }

    return response;
  };
};

async function handleDataRequest({
  loadContext,
  matches,
  request,
  serverMode,
}: {
  loadContext: AppLoadContext;
  matches: RouteMatch<ServerRoute>[];
  request: Request;
  serverMode: ServerMode;
}): Promise<Response> {
  if (!isValidRequestMethod(request)) {
    return errorBoundaryError(
      new Error(`Invalid request method "${request.method}"`),
      405
    );
  }

  let url = new URL(request.url);

  if (!matches) {
    return errorBoundaryError(
      new Error(`No route matches URL "${url.pathname}"`),
      404
    );
  }

  let response: Response;
  let match: RouteMatch<ServerRoute>;
  try {
    if (isActionRequest(request)) {
      match = getRequestMatch(url, matches);

      response = await callRouteAction({
        loadContext,
        action: match.route.module.action,
        routeId: match.route.id,
        params: match.params,
        request: request,
      });
    } else {
      let routeId = url.searchParams.get("_data");
      if (!routeId) {
        return errorBoundaryError(new Error(`Missing route id in ?_data`), 403);
      }

      let tempMatch = matches.find((match) => match.route.id === routeId);
      if (!tempMatch) {
        return errorBoundaryError(
          new Error(`Route "${routeId}" does not match URL "${url.pathname}"`),
          403
        );
      }
      match = tempMatch;

      response = await callRouteLoader({
        loadContext,
        loader: match.route.module.loader,
        routeId: match.route.id,
        params: match.params,
        request,
      });
    }

    if (isRedirectResponse(response)) {
      // We don't have any way to prevent a fetch request from following
      // redirects. So we use the `X-Remix-Redirect` header to indicate the
      // next URL, and then "follow" the redirect manually on the client.
      let headers = new Headers(response.headers);
      headers.set("X-Remix-Redirect", headers.get("Location")!);
      headers.delete("Location");
      if (response.headers.get("Set-Cookie") !== null) {
        headers.set("X-Remix-Revalidate", "yes");
      }

      return new Response(null, {
        status: 204,
        headers,
      });
    }

    return response;
  } catch (error: unknown) {
    if (serverMode !== ServerMode.Test) {
      console.error(error);
    }

    if (serverMode === ServerMode.Development && error instanceof Error) {
      return errorBoundaryError(error, 500);
    }

    return errorBoundaryError(new Error("Unexpected Server Error"), 500);
  }
}

async function handleDataRequestRR(
  serverMode: ServerMode,
  staticHandler: StaticHandler,
  routeId: string,
  request: Request
) {
  try {
    let response = await staticHandler.queryRoute(request, routeId);

    if (isRedirectResponse(response)) {
      // We don't have any way to prevent a fetch request from following
      // redirects. So we use the `X-Remix-Redirect` header to indicate the
      // next URL, and then "follow" the redirect manually on the client.
      let headers = new Headers(response.headers);
      headers.set("X-Remix-Redirect", headers.get("Location")!);
      headers.delete("Location");
      if (response.headers.get("Set-Cookie") !== null) {
        headers.set("X-Remix-Revalidate", "yes");
      }

      return new Response(null, {
        status: 204,
        headers,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof Response) {
      // To match existing behavior of remix-thrown responses,
      // we construct a new one here with a null body and just
      // the required headers. No remix-throw that surface to
      // this point will ever have a body. This contrasts with
      // the new router implementation that has a body under
      // some conditions.
      return new Response(null, {
        status: error.status,
        statusText: error.statusText,
        headers: {
          "X-Remix-Catch": "yes",
        },
      });
    }

    if (serverMode !== ServerMode.Test) {
      console.error(error);
    }

    if (serverMode === ServerMode.Development && error instanceof Error) {
      return errorBoundaryError(error, 500);
    }

    return errorBoundaryError(new Error("Unexpected Server Error"), 500);
  }
}

async function handleDocumentRequest({
  build,
  loadContext,
  matches,
  request,
  routes,
  serverMode,
}: {
  build: ServerBuild;
  loadContext: AppLoadContext;
  matches: RouteMatch<ServerRoute>[] | null;
  request: Request;
  routes: ServerRoute[];
  serverMode?: ServerMode;
}): Promise<Response> {
  let url = new URL(request.url);

  let appState: AppState = {
    trackBoundaries: true,
    trackCatchBoundaries: true,
    catchBoundaryRouteId: null,
    renderBoundaryRouteId: null,
    loaderBoundaryRouteId: null,
    error: undefined,
    catch: undefined,
  };

  if (!isValidRequestMethod(request)) {
    matches = null;
    appState.trackCatchBoundaries = false;
    appState.catch = {
      data: null,
      status: 405,
      statusText: "Method Not Allowed",
    };
  } else if (!matches) {
    appState.trackCatchBoundaries = false;
    appState.catch = {
      data: null,
      status: 404,
      statusText: "Not Found",
    };
  }

  let actionStatus: { status: number; statusText: string } | undefined;
  let actionData: Record<string, unknown> | undefined;
  let actionMatch: RouteMatch<ServerRoute> | undefined;
  let actionResponse: Response | undefined;

  if (matches && isActionRequest(request)) {
    actionMatch = getRequestMatch(url, matches);

    try {
      actionResponse = await callRouteAction({
        loadContext,
        action: actionMatch.route.module.action,
        routeId: actionMatch.route.id,
        params: actionMatch.params,
        request: request,
      });

      if (isRedirectResponse(actionResponse)) {
        return actionResponse;
      }

      actionStatus = {
        status: actionResponse.status,
        statusText: actionResponse.statusText,
      };

      if (isCatchResponse(actionResponse)) {
        appState.catchBoundaryRouteId = getDeepestRouteIdWithBoundary(
          matches,
          "CatchBoundary"
        );
        appState.trackCatchBoundaries = false;
        appState.catch = {
          ...actionStatus,
          data: await extractData(actionResponse),
        };
      } else {
        actionData = {
          [actionMatch.route.id]: await extractData(actionResponse),
        };
      }
    } catch (error: any) {
      appState.loaderBoundaryRouteId = getDeepestRouteIdWithBoundary(
        matches,
        "ErrorBoundary"
      );
      appState.trackBoundaries = false;
      appState.error = await serializeError(error);

      if (serverMode !== ServerMode.Test) {
        console.error(
          `There was an error running the action for route ${actionMatch.route.id}`
        );
      }
    }
  }

  let routeModules = createEntryRouteModules(build.routes);

  let matchesToLoad = matches || [];

  // get rid of the action, we don't want to call it's loader either
  // because we'll be rendering the error/catch boundary, if you can get
  // access to the loader data in the error/catch boundary then how the heck
  // is it supposed to deal with thrown responses and/or errors in the loader?
  if (appState.catch) {
    matchesToLoad = getMatchesUpToDeepestBoundary(
      matchesToLoad,
      "CatchBoundary"
    ).slice(0, -1);
  } else if (appState.error) {
    matchesToLoad = getMatchesUpToDeepestBoundary(
      matchesToLoad,
      "ErrorBoundary"
    ).slice(0, -1);
  }

  let loaderRequest = new Request(request.url, {
    body: null,
    headers: request.headers,
    method: request.method,
    redirect: request.redirect,
    signal: request.signal,
  });

  let routeLoaderResults = await Promise.allSettled(
    matchesToLoad.map((match) =>
      match.route.module.loader
        ? callRouteLoader({
            loadContext,
            loader: match.route.module.loader,
            routeId: match.route.id,
            params: match.params,
            request: loaderRequest,
          })
        : Promise.resolve(undefined)
    )
  );

  // Store the state of the action. We will use this to determine later
  // what catch or error boundary should be rendered under cases where
  // actions don't throw but loaders do, actions throw and parent loaders
  // also throw, etc.
  let actionCatch = appState.catch;
  let actionError = appState.error;
  let actionCatchBoundaryRouteId = appState.catchBoundaryRouteId;
  let actionLoaderBoundaryRouteId = appState.loaderBoundaryRouteId;
  // Reset the app error and catch state to propagate the loader states
  // from the results into the app state.
  appState.catch = undefined;
  appState.error = undefined;

  let headerMatches: RouteMatch<ServerRoute>[] = [];
  let routeLoaderResponses: Record<string, Response> = {};
  let loaderStatusCodes: number[] = [];
  let routeData: Record<string, unknown> = {};
  for (let index = 0; index < matchesToLoad.length; index++) {
    let match = matchesToLoad[index];
    let result = routeLoaderResults[index];

    let error = result.status === "rejected" ? result.reason : undefined;
    let response = result.status === "fulfilled" ? result.value : undefined;
    let isRedirect = response ? isRedirectResponse(response) : false;
    let isCatch = response ? isCatchResponse(response) : false;

    // If a parent loader has already caught or error'd, bail because
    // we don't need any more child data.
    if (appState.catch || appState.error) {
      break;
    }

    // If there is a response and it's a redirect, do it unless there
    // is an action error or catch state, those action boundary states
    // take precedence over loader sates, this means if a loader redirects
    // after an action catches or errors we won't follow it, and instead
    // render the boundary caused by the action.
    if (!actionCatch && !actionError && response && isRedirect) {
      return response;
    }

    // Track the boundary ID's for the loaders
    if (match.route.module.CatchBoundary) {
      appState.catchBoundaryRouteId = match.route.id;
    }
    if (match.route.module.ErrorBoundary) {
      appState.loaderBoundaryRouteId = match.route.id;
    }

    if (error) {
      loaderStatusCodes.push(500);
      appState.trackBoundaries = false;
      appState.error = await serializeError(error);

      if (serverMode !== ServerMode.Test) {
        console.error(
          `There was an error running the data loader for route ${match.route.id}`
        );
      }
      break;
    } else if (response) {
      headerMatches.push(match);
      routeLoaderResponses[match.route.id] = response;
      loaderStatusCodes.push(response.status);

      if (isCatch) {
        // If it's a catch response, store it in app state, and bail
        appState.trackCatchBoundaries = false;
        appState.catch = {
          data: await extractData(response),
          status: response.status,
          statusText: response.statusText,
        };
        break;
      } else {
        // Extract and store the loader data
        routeData[match.route.id] = await extractData(response);
      }
    }
  }

  // If there was not a loader catch or error state triggered reset the
  // boundaries as they are probably deeper in the tree if the action
  // initially triggered a boundary as that match would not exist in the
  // matches to load.
  if (!appState.catch) {
    appState.catchBoundaryRouteId = actionCatchBoundaryRouteId;
  }
  if (!appState.error) {
    appState.loaderBoundaryRouteId = actionLoaderBoundaryRouteId;
  }
  // If there was an action error or catch, we will reset the state to the
  // initial values, otherwise we will use whatever came out of the loaders.
  appState.catch = actionCatch || appState.catch;
  appState.error = actionError || appState.error;

  let renderableMatches = getRenderableMatches(matches, appState);
  if (!renderableMatches) {
    renderableMatches = [];

    let root = routes[0];
    if (root?.module.CatchBoundary) {
      appState.catchBoundaryRouteId = "root";
      renderableMatches.push({
        params: {},
        pathname: "",
        route: routes[0],
      });
    }
  }

  // Handle responses with a non-200 status code. The first loader with a
  // non-200 status code determines the status code for the whole response.
  let notOkResponse =
    actionStatus && actionStatus.status !== 200
      ? actionStatus.status
      : loaderStatusCodes.find((status) => status !== 200);

  let responseStatusCode = appState.error
    ? 500
    : typeof notOkResponse === "number"
    ? notOkResponse
    : appState.catch
    ? appState.catch.status
    : 200;

  let responseHeaders = getDocumentHeaders(
    build,
    renderableMatches,
    routeLoaderResponses,
    actionResponse
  );

  let entryMatches = createEntryMatches(renderableMatches, build.assets.routes);

  let serverHandoff = {
    actionData,
    appState: appState,
    matches: entryMatches,
    routeData,
  };

  let entryContext: EntryContext = {
    ...serverHandoff,
    manifest: build.assets,
    routeModules,
    serverHandoffString: createServerHandoffString(serverHandoff),
  };

  let handleDocumentRequest = build.entry.module.default;
  try {
    return await handleDocumentRequest(
      request,
      responseStatusCode,
      responseHeaders,
      entryContext
    );
  } catch (error: any) {
    responseStatusCode = 500;

    // Go again, this time with the componentDidCatch emulation. As it rendered
    // last time we mutated `componentDidCatch.routeId` for the last rendered
    // route, now we know where to render the error boundary (feels a little
    // hacky but that's how hooks work). This tells the emulator to stop
    // tracking the `routeId` as we render because we already have an error to
    // render.
    appState.trackBoundaries = false;
    appState.error = await serializeError(error);
    entryContext.serverHandoffString = createServerHandoffString(serverHandoff);

    try {
      return await handleDocumentRequest(
        request,
        responseStatusCode,
        responseHeaders,
        entryContext
      );
    } catch (error: any) {
      return returnLastResortErrorResponse(error, serverMode);
    }
  }
}

async function handleResourceRequestRR(
  serverMode: ServerMode,
  staticHandler: StaticHandler,
  routeId: string,
  request: Request
) {
  try {
    let response = await staticHandler.queryRoute(request, routeId);
    // Remix should always be returning responses from loaders and actions
    invariant(
      response instanceof Response,
      "Expected a Response to be returned from queryRoute"
    );
    return response;
  } catch (error) {
    return returnLastResortErrorResponse(error, serverMode);
  }
}

async function handleResourceRequest({
  loadContext,
  matches,
  request,
  serverMode,
}: {
  request: Request;
  loadContext: AppLoadContext;
  matches: RouteMatch<ServerRoute>[];
  serverMode: ServerMode;
}): Promise<Response> {
  let match = matches.slice(-1)[0];

  try {
    if (isActionRequest(request)) {
      return await callRouteAction({
        loadContext,
        action: match.route.module.action,
        routeId: match.route.id,
        params: match.params,
        request,
      });
    } else {
      return await callRouteLoader({
        loadContext,
        loader: match.route.module.loader,
        routeId: match.route.id,
        params: match.params,
        request,
      });
    }
  } catch (error: any) {
    return returnLastResortErrorResponse(error, serverMode);
  }
}

const validActionMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isActionRequest({ method }: Request): boolean {
  return validActionMethods.has(method.toUpperCase());
}

const validRequestMethods = new Set(["GET", "HEAD", ...validActionMethods]);

function isValidRequestMethod({ method }: Request): boolean {
  return validRequestMethods.has(method.toUpperCase());
}

async function errorBoundaryError(error: Error, status: number) {
  return json(await serializeError(error), {
    status,
    headers: {
      "X-Remix-Error": "yes",
    },
  });
}

function isIndexRequestUrl(url: URL) {
  // only use bare `?index` params without a value
  // ✅ /foo?index
  // ✅ /foo?index&index=123
  // ✅ /foo?index=123&index
  // ❌ /foo?index=123
  return url.searchParams.getAll("index").some((param) => param === "");
}

function getRequestMatch(url: URL, matches: RouteMatch<ServerRoute>[]) {
  let match = matches.slice(-1)[0];

  if (isIndexRequestUrl(url) && match.route.id.endsWith("/index")) {
    return match;
  }

  return getPathContributingMatches(matches).slice(-1)[0];
}

function getPathContributingMatches(matches: RouteMatch<ServerRoute>[]) {
  return matches.filter(
    (match, index) =>
      index === 0 ||
      (!match.route.index && match.route.path && match.route.path.length > 0)
  );
}

function getDeepestRouteIdWithBoundary(
  matches: RouteMatch<ServerRoute>[],
  key: "CatchBoundary" | "ErrorBoundary"
) {
  let matched = getMatchesUpToDeepestBoundary(matches, key).slice(-1)[0];
  return matched ? matched.route.id : null;
}

function getMatchesUpToDeepestBoundary(
  matches: RouteMatch<ServerRoute>[],
  key: "CatchBoundary" | "ErrorBoundary"
) {
  let deepestBoundaryIndex: number = -1;

  matches.forEach((match, index) => {
    if (match.route.module[key]) {
      deepestBoundaryIndex = index;
    }
  });

  if (deepestBoundaryIndex === -1) {
    // no route error boundaries, don't need to call any loaders
    return [];
  }

  return matches.slice(0, deepestBoundaryIndex + 1);
}

// This prevents `<Outlet/>` from rendering anything below where the error threw
// TODO: maybe do this in <RemixErrorBoundary + context>
function getRenderableMatches(
  matches: RouteMatch<ServerRoute>[] | null,
  appState: AppState
) {
  if (!matches) {
    return null;
  }

  // no error, no worries
  if (!appState.catch && !appState.error) {
    return matches;
  }

  let lastRenderableIndex: number = -1;

  matches.forEach((match, index) => {
    let id = match.route.id;
    if (
      appState.renderBoundaryRouteId === id ||
      appState.loaderBoundaryRouteId === id ||
      appState.catchBoundaryRouteId === id
    ) {
      lastRenderableIndex = index;
    }
  });

  return matches.slice(0, lastRenderableIndex + 1);
}

async function assert(
  a: Response,
  b: Response,
  accessor: (r: Response) => object | Promise<object>,
  message: string
) {
  let aStr = JSON.stringify(await accessor(a));
  let bStr = JSON.stringify(await accessor(b));
  if (aStr !== bStr) {
    console.error(message);
    message += "\nResponse 1:\n" + aStr + "\nResponse 2:\n" + bStr;
    throw new Error(message);
  }
}

async function assertResponsesMatch(_a: Response, _b: Response) {
  let a = _a.clone();
  let b = _b.clone();
  assert(
    a,
    b,
    (r) => Object.fromEntries(r.headers.entries()),
    "Headers did not match!"
  );

  if (a.headers.get("Content-Type")?.startsWith("application/json")) {
    if (a.headers.get("X-Remix-Error")) {
      assert(
        a,
        b,
        async (r) => {
          let { stack, ...json } = await r.json();
          return {
            ...json,
            stack: stack ? "yes" : "no",
          };
        },
        "JSON error response body did not match!\n Response 1:\n" +
          (await a.clone().text()) +
          "\nResponse 2:\n" +
          (await b.clone().text())
      );
    } else {
      assert(
        a,
        b,
        (r) => r.json(),
        "JSON response body did not match!\nResponse 1:\n" +
          (await a.clone().text()) +
          "\nResponse 2:\n" +
          (await b.clone().text())
      );
    }
  } else {
    assert(
      a,
      b,
      (r) => r.text(),
      "Non-JSON response body did not match!\nResponse 1:\n" +
        (await a.clone().text()) +
        "\nResponse 2:\n" +
        (await b.clone().text())
    );
  }
}

function returnLastResortErrorResponse(error: any, serverMode?: ServerMode) {
  if (serverMode !== ServerMode.Test) {
    console.error(error);
  }

  let message = "Unexpected Server Error";

  if (serverMode !== ServerMode.Production) {
    message += `\n\n${String(error)}`;
  }

  // Good grief folks, get your act together 😂!
  return new Response(message, {
    status: 500,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
