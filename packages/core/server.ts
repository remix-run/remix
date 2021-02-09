import type { AppLoadContext } from "./buildModules";
import { loadAssetManifest } from "./buildManifest";
import {
  loadRouteModule,
  loadRouteModules,
  loadServerEntryModule
} from "./buildModules";
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
import { Request, Response } from "./fetch";
import { getDocumentHeaders } from "./headers";
import { ConfigRouteMatch, matchRoutes } from "./match";
import { json, jsonError } from "./responseHelpers";
import { oneMinute } from "./seconds";

/**
 * The main request handler for a Remix server. This handler runs in the context
 * of a cloud provider's server (e.g. Express on Firebase) or locally via their
 * dev tools.
 */
export interface RequestHandler {
  (request: Request, loadContext?: AppLoadContext): Promise<Response>;
}

/**
 * Creates a handler (aka "server") that serves HTTP requests.
 */
export function createRequestHandler(config: RemixConfig): RequestHandler {
  return async (request, loadContext = {}) => {
    let url = new URL(request.url);

    if (url.searchParams.has("_manifest")) {
      return handleManifestRequest(config, request);
    }

    if (url.searchParams.has("_data")) {
      return handleDataRequest(config, request, loadContext);
    }

    return handleDocumentRequest(config, request, loadContext);
  };
}

async function handleManifestRequest(
  config: RemixConfig,
  request: Request
): Promise<Response> {
  let url = new URL(request.url);

  let matches = matchRoutes(config.routes, url.pathname);
  if (!matches) {
    return jsonError(`No route matches URL "${url.pathname}"`, 404);
  }

  let assetManifest = loadAssetManifest(config.serverBuildDirectory);
  let routeModules = loadRouteModules(
    config.serverBuildDirectory,
    matches.map(match => match.route.id)
  );

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
      // FIXME: This is a problem for anyone who is caching static assets
      // for less than 5 minutes. Long-term plan is to generate static
      // manifest files alongside the build and get rid of this endpoint.
      "Cache-Control": `public, max-age=${5 * oneMinute}`,
      ETag: entryManifest.version
    }
  });
}

async function handleDataRequest(
  config: RemixConfig,
  request: Request,
  loadContext: AppLoadContext
): Promise<Response> {
  let url = new URL(request.url);

  let matches = matchRoutes(config.routes, url.pathname);
  if (!matches) {
    return jsonError(`No route matches URL "${url.pathname}"`, 404);
  }

  let match: ConfigRouteMatch;
  if (isActionRequest(request)) {
    match = matches[matches.length - 1];
  } else {
    let routeId = url.searchParams.get("_data");
    if (!routeId) {
      return jsonError(`Missing route id in ?_data`, 403);
    }

    let routeMatch = matches.find(match => match.route.id === routeId);
    if (!routeMatch) {
      return jsonError(
        `Route "${routeId}" does not match URL "${url.pathname}"`,
        403
      );
    }

    match = routeMatch;
  }

  let route = match.route;
  let routeModule = loadRouteModule(config.serverBuildDirectory, route.id);

  let response: Response;
  try {
    if (isActionRequest(request)) {
      response = await callRouteAction(
        route.id,
        routeModule,
        request,
        loadContext,
        match.params
      );
    } else {
      response = await loadRouteData(
        route.id,
        routeModule,
        request,
        loadContext,
        match.params
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
    let locationHeader = response.headers.get("Location");
    response.headers.delete("Location");

    return new Response("", {
      status: 204,
      headers: {
        ...Object.fromEntries(response.headers),
        "X-Remix-Redirect": locationHeader!
      }
    });
  }

  return response;
}

async function handleDocumentRequest(
  config: RemixConfig,
  request: Request,
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
          id: "root",
          path: "/",
          moduleFile: "root"
        }
      },
      {
        params: {},
        pathname: url.pathname,
        route: {
          id: "routes/404",
          path: url.pathname,
          moduleFile: "routes/404",
          parentId: "root"
        }
      }
    ];
    statusCode = 404;
  }

  // Load the server build.
  let assetManifest = loadAssetManifest(config.serverBuildDirectory);
  let routeModules = loadRouteModules(
    config.serverBuildDirectory,
    matches.map(match => match.route.id)
  );
  let serverEntryModule = loadServerEntryModule(config.serverBuildDirectory);

  // Handle action requests.
  if (isActionRequest(request)) {
    let leafMatch = matches[matches.length - 1];
    let leafRoute = leafMatch.route;

    let response = await callRouteAction(
      leafRoute.id,
      routeModules[leafRoute.id],
      request,
      loadContext,
      leafMatch.params
    );

    // TODO: How do we handle errors here?

    return response;
  }

  let componentDidCatchEmulator: ComponentDidCatchEmulator = {
    trackBoundaries: true,
    renderBoundaryRouteId: null,
    loaderBoundaryRouteId: null,
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
      componentDidCatchEmulator.loaderBoundaryRouteId = route.id;
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

  let headers = getDocumentHeaders(matches, routeModules, routeLoaderResponses);

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
