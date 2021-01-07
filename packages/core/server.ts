import type { AppLoadContext } from "./buildModules";
import { ServerMode } from "./config";
import type { RemixConfig } from "./config";
import { loadGlobalData, loadRouteData, callRouteAction } from "./data";
import type { EntryManifest, ServerHandoff } from "./entry";
import {
  createEntryMatches,
  createGlobalData,
  createRouteData,
  createRouteManifest,
  createServerHandoffString
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
export function createRequestHandler(remixConfig: RemixConfig): RequestHandler {
  return async (request, session, loadContext = {}) => {
    let url = new URL(request.url);

    if (url.pathname.startsWith("/_remix/manifest")) {
      return handleManifestRequest(remixConfig, request);
    }

    if (url.pathname.startsWith("/_remix/data")) {
      return handleDataRequest(remixConfig, request, session, loadContext);
    }

    return handleDocumentRequest(remixConfig, request, session, loadContext);
  };
}

async function handleManifestRequest(
  remixConfig: RemixConfig,
  request: Request
): Promise<Response> {
  let searchParams = new URL(request.url).searchParams;
  let urlParam = searchParams.get("url");

  if (!urlParam) {
    return jsonError(`Missing ?url`, 403);
  }

  let url = new URL(urlParam);
  let matches = matchRoutes(remixConfig.routes, url.pathname);

  if (!matches) {
    return jsonError(`No routes matched path "${url.pathname}"`, 404);
  }

  let { assetManifest, routeModules } = await loadServerBuild(
    remixConfig,
    matches.map(match => match.route.id)
  );

  let entryManifest: EntryManifest = {
    version: assetManifest.version,
    routes: createRouteManifest(
      matches,
      routeModules,
      assetManifest.entries,
      remixConfig.publicPath
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
  remixConfig: RemixConfig,
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

  let loaderPromise: Promise<Response>;
  if (loaderId === "_global") {
    let { globalDataModule } = await loadServerBuild(remixConfig);

    loaderPromise = globalDataModule
      ? loadGlobalData(globalDataModule, loaderRequest, session, loadContext)
      : Promise.resolve(json(null));
  } else {
    let { routeModules } = await loadServerBuild(remixConfig, [loaderId]);

    loaderPromise = isActionRequest(loaderRequest)
      ? callRouteAction(
          loaderId,
          routeModules[loaderId],
          loaderRequest,
          session,
          loadContext,
          params
        )
      : loadRouteData(
          routeModules[loaderId],
          loaderRequest,
          session,
          loadContext,
          params
        );
  }

  let response: Response;
  try {
    response = await loaderPromise;
  } catch (error) {
    // TODO: Send an error response.
    throw error;
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
  remixConfig: RemixConfig,
  request: Request,
  session: Session,
  loadContext: AppLoadContext = {}
): Promise<Response> {
  let url = new URL(request.url);
  let matches = matchRoutes(remixConfig.routes, url.pathname);
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
    globalDataModule,
    routeModules
  } = await loadServerBuild(
    remixConfig,
    matches.map(match => match.route.id)
  );

  // Handle action requests.
  if (isActionRequest(request)) {
    let leafMatch = matches[matches.length - 1];
    let response = await callRouteAction(
      leafMatch.route.id,
      routeModules[leafMatch.route.id],
      request,
      session,
      loadContext,
      leafMatch.params
    );

    return response;
  }

  // Run all data loaders in parallel. Await them in series below.
  let globalLoaderPromise = globalDataModule
    ? loadGlobalData(globalDataModule, request.clone(), session, loadContext)
    : Promise.resolve(json(null));
  let routeLoaderPromises = matches.map(match =>
    loadRouteData(
      routeModules[match.route.id],
      request.clone(),
      session,
      loadContext,
      match.params
    )
  );

  async function handleDataLoaderError(error: Error) {
    if (remixConfig.serverMode !== ServerMode.Test) {
      console.error(error);
    }

    matches = [
      {
        params: {},
        pathname: url.pathname,
        route: {
          id: "routes/500",
          path: url.pathname,
          moduleFile: "routes/500"
        }
      }
    ];
    statusCode = 500;

    // Need to reload the route modules so we can generate the entry manifest...
    routeModules = (await loadServerBuild(remixConfig, ["routes/500"]))
      .routeModules;
  }

  let globalLoaderResponse: Response;
  try {
    globalLoaderResponse = await globalLoaderPromise;
  } catch (error) {
    globalLoaderResponse = json(null);

    console.error(`There was an error running the global data loader`);

    await handleDataLoaderError(error);
  }

  let routeLoaderResponses: Response[] = [];
  for (let promise of routeLoaderPromises) {
    try {
      routeLoaderResponses.push(await promise);
    } catch (error) {
      routeLoaderResponses.push(json(null));

      let route = matches[routeLoaderResponses.length - 1].route;
      console.error(
        `There was an error running the data loader for route ${route.id}`
      );

      await handleDataLoaderError(error);
    }
  }

  let allResponses = [globalLoaderResponse, ...routeLoaderResponses];

  // Handle redirects. A redirect in a loader takes precedence over all
  // other responses and is immediately returned.
  let redirectResponse = allResponses.find(isRedirectResponse);
  if (redirectResponse) {
    return redirectResponse;
  }

  // Handle responses with a non-200 status code. The first loader with a
  // non-200 status code determines the status code for the whole response.
  let notOkResponse = allResponses.find(response => response.status !== 200);
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
      remixConfig.publicPath
    ),
    entryModuleUrl:
      remixConfig.publicPath + assetManifest.entries["entry-browser"].file,
    globalLoaderUrl:
      globalDataModule && typeof globalDataModule.loader !== "undefined"
        ? "/_remix/data"
        : undefined,
    globalStylesUrl:
      "global.css" in assetManifest.entries
        ? remixConfig.publicPath + assetManifest.entries["global.css"].file
        : undefined
  };
  let entryMatches = createEntryMatches(entryManifest.routes, matches);
  let globalData = await createGlobalData(globalLoaderResponse);
  let routeData = await createRouteData(routeLoaderResponses, matches);

  let serverHandoff: ServerHandoff = {
    globalData,
    manifest: entryManifest,
    matches: entryMatches,
    routeData
  };

  let serverEntryContext = {
    ...serverHandoff,
    routeModules,
    componentDidCatchEmulator: {
      error: undefined,
      routeId: null
    },
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
        console.error(
          `There was an error getting headers for route ${routeId}`
        );
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
    // Go again, this time with the componentDidCatch emulation. Remember, the
    // routes `componentDidCatch.routeId` because we can't know that here. (Well
    // ... maybe we could, we could search the error.stack lines for the first
    // file matching the id of a route from the route manifest, but that would
    // require us to have source maps installed so the filenames don't get
    // changed when we bundle, and just feels a little too shakey for me right
    // now. I'm okay with tracking our position in the route tree while
    // rendering, that's pretty much how hooks work 😂)
    serverEntryContext.componentDidCatchEmulator.error = error;

    try {
      response = serverEntryModule.default(
        request,
        statusCode,
        headers,
        serverEntryContext
      );
    } catch (error) {
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
