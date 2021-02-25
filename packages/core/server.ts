import type { AppLoadContext } from "./buildModules";
import {
  loadRouteModule,
  loadRouteModules,
  loadServerEntryModule
} from "./buildModules";
import type { RemixConfig } from "./config";
import { ServerMode } from "./config/serverModes";
import { loadRouteData, callRouteAction } from "./data";
import { ComponentDidCatchEmulator, EntryContext, getManifest } from "./entry";
import {
  createEntryMatches,
  createRouteData,
  createServerHandoffString,
  serializeError
} from "./entry";
import { Request, Response } from "./fetch";
import { getDocumentHeaders } from "./headers";
import { ConfigRouteMatch, matchRoutes } from "./match";
import { json, jsonError } from "./responses";

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

    if (url.pathname.match(/remix-manifest-(.+)\.js$/)) {
      return handleManifestRequest(config);
    }

    if (url.searchParams.has("_data")) {
      return handleDataRequest(config, request, loadContext);
    }

    return handleDocumentRequest(config, request, loadContext);
  };
}

function handleManifestRequest(config: RemixConfig) {
  let manifest = getManifest(config);
  return new Response(`window.__remixManifest = ${JSON.stringify(manifest)}`, {
    headers: {
      "Content-Type": "text/javascript",

      // Assumptions about this cache control:
      //
      // - When people deploy, they will purge the documents and the manifest
      //   requests together
      // - This automatically happens on Firebase, Vercel, Netlify, (Architect maybe?)
      // - Even without a purged cdn cache, people will set a smaller s-maxage
      //   on their document headers than this (max-age doesn't matter since
      //   browsers always go for the 304 on document requests)
      // - Even if they don't, they will likely expire together since 1y is the
      //   maximum age pretty much everywhere.
      //
      // Only time this is a problem is if:
      //
      // - CDN has purged the manifest request
      // - CDN has *not* purged the document request asking for a manifest
      //
      // Seems like an unlikely situation, and easily fixed by purging the
      // documents. The developer was likely manually goofing around with
      // purges, and that's their own issue to deal with.
      //
      // It's important to cache this long so that subsequent document
      // navigations aren't slowed down by a request to the origin server for
      // the manifest (which grows as more routes are added to the overall app).
      // It will (most likely) expire with the documents on deploy, or the
      // documents will expire sooner and stop asking for this particular
      // manifest.
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      Etag: manifest.version
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
    // TODO: Provide a default 404 page
    throw new Error(
      `There is no route that matches ${url.pathname}. Please add ` +
        `a routes/404.js file`
    );
  }

  let leafMatch = matches[matches.length - 1];
  let leafRoute = leafMatch.route;

  if (leafRoute.id === "routes/404") {
    statusCode = 404;
  }

  // Handle action requests.
  if (isActionRequest(request)) {
    let routeModule = loadRouteModule(
      config.serverBuildDirectory,
      leafRoute.id
    );
    let response = await callRouteAction(
      leafRoute.id,
      routeModule,
      request,
      loadContext,
      leafMatch.params
    );

    // TODO: How do we handle errors here?

    return response;
  }

  // Load the server build.
  let serverEntryModule = loadServerEntryModule(config.serverBuildDirectory);
  let routeModules = loadRouteModules(
    config.serverBuildDirectory,
    matches.map(match => match.route.id)
  );

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

  let manifest = getManifest(config);

  let entryMatches = createEntryMatches(manifest.routes, matches);
  let routeData = await createRouteData(routeLoaderResponses, matches);

  let serverHandoff = {
    matches: entryMatches,
    componentDidCatchEmulator,
    routeData
  };

  let serverEntryContext: EntryContext = {
    ...serverHandoff,
    manifest,
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
