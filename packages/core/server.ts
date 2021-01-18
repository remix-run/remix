import type { AppLoadContext } from "./buildModules";
import type { RemixConfig } from "./config";
import { ServerMode } from "./config";
import { loadRouteData, callRouteAction } from "./data";
import type {
  ComponentDidCatchEmulator,
  EntryManifest,
  EntryContext
} from "./entry";
import {
  createEntryMatches,
  createRouteData,
  createRouteManifest,
  createServerHandoffString,
  serializeError
} from "./entry";
import { Headers, Request, Response } from "./fetch";
import { matchRoutes } from "./match";
import { json, jsonError } from "./responseHelpers";
import { loadServerBuild } from "./serverHelpers";
import type { Session } from "./sessions";
import { oneYear } from "./seconds";

/**
 * The main request handler for a Remix server. This handler runs in the context
 * of a cloud provider's server (e.g. Express on Firebase) or locally via their
 * dev tools.
 */
export interface RequestHandler {
  (
    request: Request,
    session: Session,
    loadContext?: AppLoadContext
  ): Promise<Response>;
}

/**
 * Creates a handler (aka "server") that serves HTTP requests.
 *
 * In production mode, the server reads the build from disk. In development, it
 * dynamically generates the build at request time for only the modules needed
 * to serve that request.
 */
export function createRequestHandler(config: RemixConfig): RequestHandler {
  return async (request, session, loadContext = {}) => {
    let url = new URL(request.url);

    if (url.pathname.startsWith("/_remix/manifest")) {
      return handleManifestRequest(config, request);
    }

    if (url.pathname.startsWith("/_remix/data")) {
      return handleDataRequest(config, request, session, loadContext);
    }

    return handleDocumentRequest(config, request, session, loadContext);
  };
}

async function handleManifestRequest(
  config: RemixConfig,
  request: Request
): Promise<Response> {
  let searchParams = new URL(request.url).searchParams;
  let urlParam = searchParams.get("url");

  if (!urlParam) {
    return jsonError(`Missing ?url`, 403);
  }

  let url = new URL(urlParam);
  let matches = matchRoutes(config.routes, url.pathname);

  if (!matches) {
    return jsonError(`No routes matched path "${url.pathname}"`, 404);
  }

  let { assetManifest, routeModules } = await loadServerBuild(config);

  let entryManifest: EntryManifest = {
    version: assetManifest.version,
    routes: createRouteManifest(
      matches,
      routeModules,
      assetManifest.entries,
      config.publicPath
    )
  };

  return json(entryManifest, {
    headers: {
      "Cache-Control": `public, max-age=${oneYear}`,
      ETag: entryManifest.version
    }
  });
}

async function handleDataRequest(
  config: RemixConfig,
  request: Request,
  session: Session,
  loadContext: AppLoadContext
): Promise<Response> {
  let searchParams = new URL(request.url).searchParams;
  let urlParam = searchParams.get("url");
  let loaderId = searchParams.get("id");
  let params = JSON.parse(searchParams.get("params") || "{}");

  if (!urlParam) {
    return jsonError(`Missing ?url`, 403);
  }
  if (!loaderId) {
    return jsonError(`Missing ?id`, 403);
  }

  let url = new URL(urlParam);
  let loaderRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  let { routeModules } = await loadServerBuild(config);

  let response: Response;
  try {
    if (isActionRequest(loaderRequest)) {
      response = await callRouteAction(
        loaderId,
        routeModules[loaderId],
        loaderRequest,
        session,
        loadContext,
        params
      );
    } else {
      response = await loadRouteData(
        loaderId,
        routeModules[loaderId],
        loaderRequest,
        session,
        loadContext,
        params
      );
    }
  } catch (error) {
    return json(serializeError(error), {
      status: 500,
      headers: {
        "X-Remix-Error": "unfortunately, yes"
      }
    });
  }

  if (isRedirectResponse(response)) {
    // We don't have any way to prevent a fetch request from following
    // redirects. So we use the `X-Remix-Redirect` header to indicate the
    // next URL, and then "follow" the redirect manually on the client.
    return new Response("", {
      status: 204,
      headers: {
        "X-Remix-Redirect": response.headers.get("Location")!
      }
    });
  }

  return response;
}

async function handleDocumentRequest(
  config: RemixConfig,
  request: Request,
  session: Session,
  loadContext: AppLoadContext = {}
): Promise<Response> {
  let url = new URL(request.url);
  let matches = matchRoutes(config.routes, url.pathname);
  let statusCode = 200;

  if (!matches) {
    matches = [
      {
        params: {},
        pathname: url.pathname,
        route: {
          id: "routes/404",
          path: url.pathname,
          moduleFile: "routes/404"
        }
      }
    ];
    statusCode = 404;
  }

  // Load the server build.
  let {
    assetManifest,
    serverEntryModule,
    routeModules
  } = await loadServerBuild(config);

  // Handle action requests.
  if (isActionRequest(request)) {
    let leafMatch = matches[matches.length - 1];
    let route = leafMatch.route;

    let response = await callRouteAction(
      route.id,
      routeModules[route.id],
      request,
      session,
      loadContext,
      leafMatch.params
    );

    // TODO: How do we handle errors here?

    return response;
  }

  let componentDidCatchEmulator: ComponentDidCatchEmulator = {
    trackBoundaries: true,
    boundaryRouteId: null,
    error: undefined
  };

  // Run all data loaders in parallel. Await them in series below.
  // Note: This code is a little weird due to the way unhandled promise
  // rejections are handled in node. We use a .catch() handler on each
  // promise to avoid the warning, then handle errors manually afterwards.
  let routeLoaderPromises: Promise<Response | Error>[] = matches.map(match =>
    loadRouteData(
      match.route.id,
      routeModules[match.route.id],
      request.clone(),
      session,
      loadContext,
      match.params
    ).catch(error => error)
  );

  let routeLoaderResults = await Promise.all(routeLoaderPromises);
  for (let [index, response] of routeLoaderResults.entries()) {
    if (componentDidCatchEmulator.error) {
      continue;
    }

    let route = matches[index].route;
    let routeModule = routeModules[route.id];

    if (routeModule.ErrorBoundary) {
      componentDidCatchEmulator.boundaryRouteId = route.id;
    }

    if (response instanceof Error) {
      if (config.serverMode !== ServerMode.Test) {
        console.error(
          `There was an error running the data loader for route ${route.id}`
        );
      }
      componentDidCatchEmulator.error = serializeError(response);
      routeLoaderResults[index] = json(null, { status: 500 });
    } else if (isRedirectResponse(response)) {
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
  if (notOkResponse) {
    statusCode = notOkResponse.status;
  }

  // Prepare variables to be used in the client.
  let entryManifest: EntryManifest = {
    version: assetManifest.version,
    routes: createRouteManifest(
      matches,
      routeModules,
      assetManifest.entries,
      config.publicPath
    ),
    entryModuleUrl:
      config.publicPath + assetManifest.entries["entry-browser"].file,
    globalStylesUrl:
      "global.css" in assetManifest.entries
        ? config.publicPath + assetManifest.entries["global.css"].file
        : undefined
  };
  let entryMatches = createEntryMatches(entryManifest.routes, matches);
  let routeData = await createRouteData(routeLoaderResponses, matches);

  let serverHandoff = {
    manifest: entryManifest,
    matches: entryMatches,
    componentDidCatchEmulator,
    routeData
  };

  let serverEntryContext: EntryContext = {
    ...serverHandoff,
    routeModules,
    serverHandoffString: createServerHandoffString(serverHandoff)
  };

  // Calculate response headers from the matched routes.
  let headers = matches.reduce((parentsHeaders, match, index) => {
    let routeId = match.route.id;
    let routeModule = routeModules[routeId];

    if (typeof routeModule.headers === "function") {
      try {
        let response = routeLoaderResponses[index];
        let routeHeaders = routeModule.headers({
          loaderHeaders: response.headers,
          parentsHeaders
        });

        if (routeHeaders) {
          for (let [key, value] of new Headers(routeHeaders).entries()) {
            parentsHeaders.set(key, value);
          }
        }
      } catch (error) {
        if (config.serverMode !== ServerMode.Test) {
          console.error(
            `There was an error getting headers for route ${routeId}`
          );
        }
        console.error(error);
      }
    }

    return parentsHeaders;
  }, new Headers());

  let response: Promise<Response> | Response;
  try {
    response = serverEntryModule.default(
      request,
      statusCode,
      headers,
      serverEntryContext
    );
  } catch (error) {
    if (config.serverMode !== ServerMode.Test) {
      console.error(error);
    }

    statusCode = 500;

    // Go again, this time with the componentDidCatch emulation. Remember, the
    // routes `componentDidCatch.routeId` because we can't know that here. (Well
    // ... maybe we could, we could search the error.stack lines for the first
    // file matching the id of a route from the route manifest, but that would
    // require us to have source maps installed so the filenames don't get
    // changed when we bundle, and just feels a little too shakey for me right
    // now. I'm okay with tracking our position in the route tree while
    // rendering, that's pretty much how hooks work 😂)
    componentDidCatchEmulator.trackBoundaries = false;
    componentDidCatchEmulator.error = serializeError(error);
    serverEntryContext.serverHandoffString = createServerHandoffString(
      serverHandoff
    );

    try {
      response = serverEntryModule.default(
        request,
        statusCode,
        headers,
        serverEntryContext
      );
    } catch (error) {
      if (config.serverMode !== ServerMode.Test) {
        console.error(error);
      }

      // Good grief folks, get your act together 😂!
      // TODO: Something is wrong in serverEntryModule, use the default root error handler
      response = new Response(`Unexpected Server Error\n\n${error.message}`, {
        status: 500,
        headers: { "content-type": "text/plain" }
      });
    }
  }

  return response;
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);

function isRedirectResponse(response: Response): boolean {
  return redirectStatusCodes.has(response.status);
}

function isActionRequest(request: Request): boolean {
  return request.method.toLowerCase() !== "get";
}
