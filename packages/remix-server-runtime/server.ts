import type {
  UNSAFE_DeferredData as DeferredData,
  ErrorResponse,
  StaticHandler,
} from "@remix-run/router";
import {
  UNSAFE_DEFERRED_SYMBOL as DEFERRED_SYMBOL,
  getStaticContextFromError,
  isRouteErrorResponse,
  createStaticHandler,
  json as routerJson,
  stripBasename,
  UNSAFE_ErrorResponseImpl as ErrorResponseImpl,
} from "@remix-run/router";

import type { AppLoadContext } from "./data";
import type { HandleErrorFunction, ServerBuild } from "./build";
import type { EntryContext } from "./entry";
import { createEntryRouteModules } from "./entry";
import { sanitizeErrors, serializeError, serializeErrors } from "./errors";
import { getDocumentHeaders } from "./headers";
import invariant from "./invariant";
import { ServerMode, isServerMode } from "./mode";
import type { RouteMatch } from "./routeMatching";
import { matchServerRoutes } from "./routeMatching";
import type { EntryRoute, ServerRoute } from "./routes";
import { createStaticHandlerDataRoutes, createRoutes } from "./routes";
import {
  createDeferredReadableStream,
  isRedirectResponse,
  isResponse,
  json,
} from "./responses";
import { createServerHandoffString } from "./serverHandoff";
import { getDevServerHooks } from "./dev";
import type { SingleFetchResult, SingleFetchResults } from "./single-fetch";
import {
  encodeViaTurboStream,
  getSingleFetchRedirect,
  singleFetchAction,
  singleFetchLoaders,
  SingleFetchRedirectSymbol,
  SINGLE_FETCH_REDIRECT_STATUS,
} from "./single-fetch";
import { resourceRouteJsonWarning } from "./deprecations";

export type RequestHandler = (
  request: Request,
  loadContext?: AppLoadContext
) => Promise<Response>;

export type CreateRequestHandlerFunction = (
  build: ServerBuild | (() => ServerBuild | Promise<ServerBuild>),
  mode?: string
) => RequestHandler;

// Do not include a response body if the status code is one of these,
// otherwise `undici` will throw an error when constructing the Response:
//   https://github.com/nodejs/undici/blob/bd98a6303e45d5e0d44192a93731b1defdb415f3/lib/web/fetch/response.js#L522-L528
//
// Specs:
//   https://datatracker.ietf.org/doc/html/rfc9110#name-informational-1xx
//   https://datatracker.ietf.org/doc/html/rfc9110#name-204-no-content
//   https://datatracker.ietf.org/doc/html/rfc9110#name-205-reset-content
//   https://datatracker.ietf.org/doc/html/rfc9110#name-304-not-modified
const NO_BODY_STATUS_CODES = new Set([100, 101, 204, 205, 304]);

function derive(build: ServerBuild, mode?: string) {
  let routes = createRoutes(build.routes);
  let dataRoutes = createStaticHandlerDataRoutes(build.routes, build.future);
  let serverMode = isServerMode(mode) ? mode : ServerMode.Production;
  let staticHandler = createStaticHandler(dataRoutes, {
    basename: build.basename,
    future: {
      v7_relativeSplatPath: build.future?.v3_relativeSplatPath === true,
      v7_throwAbortReason: build.future?.v3_throwAbortReason === true,
    },
  });

  let errorHandler =
    build.entry.module.handleError ||
    ((error, { request }) => {
      if (serverMode !== ServerMode.Test && !request.signal.aborted) {
        console.error(
          // @ts-expect-error This is "private" from users but intended for internal use
          isRouteErrorResponse(error) && error.error ? error.error : error
        );
      }
    });
  return {
    routes,
    dataRoutes,
    serverMode,
    staticHandler,
    errorHandler,
  };
}

export const createRequestHandler: CreateRequestHandlerFunction = (
  build,
  mode
) => {
  let _build: ServerBuild;
  let routes: ServerRoute[];
  let serverMode: ServerMode;
  let staticHandler: StaticHandler;
  let errorHandler: HandleErrorFunction;

  return async function requestHandler(request, loadContext = {}) {
    _build = typeof build === "function" ? await build() : build;
    mode ??= _build.mode;
    if (typeof build === "function") {
      let derived = derive(_build, mode);
      routes = derived.routes;
      serverMode = derived.serverMode;
      staticHandler = derived.staticHandler;
      errorHandler = derived.errorHandler;
    } else if (!routes || !serverMode || !staticHandler || !errorHandler) {
      let derived = derive(_build, mode);
      routes = derived.routes;
      serverMode = derived.serverMode;
      staticHandler = derived.staticHandler;
      errorHandler = derived.errorHandler;
    }

    let url = new URL(request.url);
    let params: RouteMatch<ServerRoute>["params"] = {};
    let handleError = (error: unknown) => {
      if (mode === ServerMode.Development) {
        getDevServerHooks()?.processRequestError?.(error);
      }

      errorHandler(error, {
        context: loadContext,
        params,
        request,
      });
    };

    // Manifest request for fog of war

    let manifestUrl = `${_build.basename ?? "/"}/__manifest`.replace(
      /\/+/g,
      "/"
    );
    if (url.pathname === manifestUrl) {
      try {
        let res = await handleManifestRequest(_build, routes, url);
        return res;
      } catch (e) {
        handleError(e);
        return new Response("Unknown Server Error", { status: 500 });
      }
    }

    let matches = matchServerRoutes(routes, url.pathname, _build.basename);
    if (matches && matches.length > 0) {
      Object.assign(params, matches[0].params);
    }

    let response: Response;
    if (url.searchParams.has("_data")) {
      if (_build.future.v3_singleFetch) {
        handleError(
          new Error(
            "Warning: Single fetch-enabled apps should not be making ?_data requests, " +
              "this is likely to break in the future"
          )
        );
      }
      let routeId = url.searchParams.get("_data")!;

      response = await handleDataRequest(
        serverMode,
        _build,
        staticHandler,
        routeId,
        request,
        loadContext,
        handleError
      );

      if (_build.entry.module.handleDataRequest) {
        response = await _build.entry.module.handleDataRequest(response, {
          context: loadContext,
          params,
          request,
        });

        if (isRedirectResponse(response)) {
          response = createRemixRedirectResponse(response, _build.basename);
        }
      }
    } else if (_build.future.v3_singleFetch && url.pathname.endsWith(".data")) {
      let handlerUrl = new URL(request.url);
      handlerUrl.pathname = handlerUrl.pathname
        .replace(/\.data$/, "")
        .replace(/^\/_root$/, "/");

      let singleFetchMatches = matchServerRoutes(
        routes,
        handlerUrl.pathname,
        _build.basename
      );

      response = await handleSingleFetchRequest(
        serverMode,
        _build,
        staticHandler,
        request,
        handlerUrl,
        loadContext,
        handleError
      );

      if (_build.entry.module.handleDataRequest) {
        response = await _build.entry.module.handleDataRequest(response, {
          context: loadContext,
          params: singleFetchMatches ? singleFetchMatches[0].params : {},
          request,
        });

        if (isRedirectResponse(response)) {
          let result: SingleFetchResult | SingleFetchResults =
            getSingleFetchRedirect(
              response.status,
              response.headers,
              _build.basename
            );

          if (request.method === "GET") {
            result = {
              [SingleFetchRedirectSymbol]: result,
            };
          }
          let headers = new Headers(response.headers);
          headers.set("Content-Type", "text/x-script");

          return new Response(
            encodeViaTurboStream(
              result,
              request.signal,
              _build.entry.module.streamTimeout,
              serverMode
            ),
            {
              status: SINGLE_FETCH_REDIRECT_STATUS,
              headers,
            }
          );
        }
      }
    } else if (
      matches &&
      matches[matches.length - 1].route.module.default == null &&
      matches[matches.length - 1].route.module.ErrorBoundary == null
    ) {
      response = await handleResourceRequest(
        serverMode,
        _build,
        staticHandler,
        matches.slice(-1)[0].route.id,
        request,
        loadContext,
        handleError
      );
    } else {
      let criticalCss =
        mode === ServerMode.Development
          ? await getDevServerHooks()?.getCriticalCss?.(_build, url.pathname)
          : undefined;

      response = await handleDocumentRequest(
        serverMode,
        _build,
        staticHandler,
        request,
        loadContext,
        handleError,
        criticalCss
      );
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

async function handleManifestRequest(
  build: ServerBuild,
  routes: ServerRoute[],
  url: URL
) {
  let patches: Record<string, EntryRoute> = {};

  if (url.searchParams.has("p")) {
    for (let path of url.searchParams.getAll("p")) {
      let matches = matchServerRoutes(routes, path, build.basename);
      if (matches) {
        for (let match of matches) {
          let routeId = match.route.id;
          patches[routeId] = build.assets.routes[routeId];
        }
      }
    }

    return json(patches, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }) as Response; // Override the TypedResponse stuff from json()
  }

  return new Response("Invalid Request", { status: 400 });
}

async function handleDataRequest(
  serverMode: ServerMode,
  build: ServerBuild,
  staticHandler: StaticHandler,
  routeId: string,
  request: Request,
  loadContext: AppLoadContext,
  handleError: (err: unknown) => void
) {
  try {
    let response = await staticHandler.queryRoute(request, {
      routeId,
      requestContext: loadContext,
    });

    if (isRedirectResponse(response)) {
      return createRemixRedirectResponse(response, build.basename);
    }

    if (DEFERRED_SYMBOL in response) {
      let deferredData = response[DEFERRED_SYMBOL] as DeferredData;
      let body = createDeferredReadableStream(
        deferredData,
        request.signal,
        serverMode
      );
      let init = deferredData.init || {};
      let headers = new Headers(init.headers);
      headers.set("Content-Type", "text/remix-deferred");
      // Mark successful responses with a header so we can identify in-flight
      // network errors that are missing this header
      headers.set("X-Remix-Response", "yes");
      init.headers = headers;
      return new Response(body, init);
    }

    // Mark all successful responses with a header so we can identify in-flight
    // network errors that are missing this header
    response = safelySetHeader(response, "X-Remix-Response", "yes");
    return response;
  } catch (error: unknown) {
    if (isResponse(error)) {
      let response = safelySetHeader(error, "X-Remix-Catch", "yes");
      return response;
    }

    if (isRouteErrorResponse(error)) {
      handleError(error);
      return errorResponseToJson(error, serverMode);
    }

    let errorInstance =
      error instanceof Error || error instanceof DOMException
        ? error
        : new Error("Unexpected Server Error");
    handleError(errorInstance);
    return routerJson(serializeError(errorInstance, serverMode), {
      status: 500,
      headers: {
        "X-Remix-Error": "yes",
      },
    });
  }
}

async function handleSingleFetchRequest(
  serverMode: ServerMode,
  build: ServerBuild,
  staticHandler: StaticHandler,
  request: Request,
  handlerUrl: URL,
  loadContext: AppLoadContext,
  handleError: (err: unknown) => void
): Promise<Response> {
  let { result, headers, status } =
    request.method !== "GET"
      ? await singleFetchAction(
          build,
          serverMode,
          staticHandler,
          request,
          handlerUrl,
          loadContext,
          handleError
        )
      : await singleFetchLoaders(
          build,
          serverMode,
          staticHandler,
          request,
          handlerUrl,
          loadContext,
          handleError
        );

  // Mark all successful responses with a header so we can identify in-flight
  // network errors that are missing this header
  let resultHeaders = new Headers(headers);
  resultHeaders.set("X-Remix-Response", "yes");

  // Skip response body for unsupported status codes
  if (NO_BODY_STATUS_CODES.has(status)) {
    return new Response(null, { status, headers: resultHeaders });
  }

  // We use a less-descriptive `text/x-script` here instead of something like
  // `text/x-turbo` to enable compression when deployed via Cloudflare.  See:
  //  - https://github.com/remix-run/remix/issues/9884
  //  - https://developers.cloudflare.com/speed/optimization/content/brotli/content-compression/
  resultHeaders.set("Content-Type", "text/x-script");

  // Note: Deferred data is already just Promises, so we don't have to mess
  // `activeDeferreds` or anything :)
  return new Response(
    encodeViaTurboStream(
      result,
      request.signal,
      build.entry.module.streamTimeout,
      serverMode
    ),
    {
      status: status || 200,
      headers: resultHeaders,
    }
  );
}

async function handleDocumentRequest(
  serverMode: ServerMode,
  build: ServerBuild,
  staticHandler: StaticHandler,
  request: Request,
  loadContext: AppLoadContext,
  handleError: (err: unknown) => void,
  criticalCss?: string
) {
  let context;
  try {
    context = await staticHandler.query(request, {
      requestContext: loadContext,
    });
  } catch (error: unknown) {
    handleError(error);
    return new Response(null, { status: 500 });
  }

  if (isResponse(context)) {
    return context;
  }

  let headers = getDocumentHeaders(build, context);

  // Skip response body for unsupported status codes
  if (NO_BODY_STATUS_CODES.has(context.statusCode)) {
    return new Response(null, { status: context.statusCode, headers });
  }

  // Sanitize errors outside of development environments
  if (context.errors) {
    Object.values(context.errors).forEach((err) => {
      // @ts-expect-error `err.error` is "private" from users but intended for internal use
      if (!isRouteErrorResponse(err) || err.error) {
        handleError(err);
      }
    });
    context.errors = sanitizeErrors(context.errors, serverMode);
  }

  // Server UI state to send to the client.
  // - When single fetch is enabled, this is streamed down via `serverHandoffStream`
  // - Otherwise it's stringified into `serverHandoffString`
  let state = {
    loaderData: context.loaderData,
    actionData: context.actionData,
    errors: serializeErrors(context.errors, serverMode),
  };
  let entryContext: EntryContext = {
    manifest: build.assets,
    routeModules: createEntryRouteModules(build.routes),
    staticHandlerContext: context,
    criticalCss,
    serverHandoffString: createServerHandoffString({
      basename: build.basename,
      criticalCss,
      future: build.future,
      isSpaMode: build.isSpaMode,
      ...(!build.future.v3_singleFetch ? { state } : null),
    }),
    ...(build.future.v3_singleFetch
      ? {
          serverHandoffStream: encodeViaTurboStream(
            state,
            request.signal,
            build.entry.module.streamTimeout,
            serverMode
          ),
          renderMeta: {},
        }
      : null),
    future: build.future,
    isSpaMode: build.isSpaMode,
    serializeError: (err) => serializeError(err, serverMode),
  };

  let handleDocumentRequestFunction = build.entry.module.default;
  try {
    return await handleDocumentRequestFunction(
      request,
      context.statusCode,
      headers,
      entryContext,
      loadContext
    );
  } catch (error: unknown) {
    handleError(error);

    let errorForSecondRender = error;

    // If they threw a response, unwrap it into an ErrorResponse like we would
    // have for a loader/action
    if (isResponse(error)) {
      try {
        let data = await unwrapResponse(error);
        errorForSecondRender = new ErrorResponseImpl(
          error.status,
          error.statusText,
          data
        );
      } catch (e) {
        // If we can't unwrap the response - just leave it as-is
      }
    }

    // Get a new StaticHandlerContext that contains the error at the right boundary
    context = getStaticContextFromError(
      staticHandler.dataRoutes,
      context,
      errorForSecondRender
    );

    // Sanitize errors outside of development environments
    if (context.errors) {
      context.errors = sanitizeErrors(context.errors, serverMode);
    }

    // Get a new entryContext for the second render pass
    // Server UI state to send to the client.
    // - When single fetch is enabled, this is streamed down via `serverHandoffStream`
    // - Otherwise it's stringified into `serverHandoffString`
    let state = {
      loaderData: context.loaderData,
      actionData: context.actionData,
      errors: serializeErrors(context.errors, serverMode),
    };
    entryContext = {
      ...entryContext,
      staticHandlerContext: context,
      serverHandoffString: createServerHandoffString({
        basename: build.basename,
        future: build.future,
        isSpaMode: build.isSpaMode,
        ...(!build.future.v3_singleFetch ? { state } : null),
      }),
      ...(build.future.v3_singleFetch
        ? {
            serverHandoffStream: encodeViaTurboStream(
              state,
              request.signal,
              build.entry.module.streamTimeout,
              serverMode
            ),
            renderMeta: {},
          }
        : null),
    };

    try {
      return await handleDocumentRequestFunction(
        request,
        context.statusCode,
        headers,
        entryContext,
        loadContext
      );
    } catch (error: any) {
      handleError(error);
      return returnLastResortErrorResponse(error, serverMode);
    }
  }
}

async function handleResourceRequest(
  serverMode: ServerMode,
  build: ServerBuild,
  staticHandler: StaticHandler,
  routeId: string,
  request: Request,
  loadContext: AppLoadContext,
  handleError: (err: unknown) => void
) {
  try {
    // Note we keep the routeId here to align with the Remix handling of
    // resource routes which doesn't take ?index into account and just takes
    // the leaf match
    let response = await staticHandler.queryRoute(request, {
      routeId,
      requestContext: loadContext,
    });

    if (typeof response === "object" && response !== null) {
      invariant(
        !(DEFERRED_SYMBOL in response),
        `You cannot return a \`defer()\` response from a Resource Route.  Did you ` +
          `forget to export a default UI component from the "${routeId}" route?`
      );
    }

    if (build.future.v3_singleFetch && !isResponse(response)) {
      console.warn(
        resourceRouteJsonWarning(
          request.method === "GET" ? "loader" : "action",
          routeId
        )
      );
      response = json(response);
    }

    // callRouteLoader/callRouteAction always return responses (w/o single fetch).
    // With single fetch, users should always be Responses from resource routes
    invariant(
      isResponse(response),
      "Expected a Response to be returned from queryRoute"
    );
    return response;
  } catch (error: unknown) {
    if (isResponse(error)) {
      // Note: Not functionally required but ensures that our response headers
      // match identically to what Remix returns
      let response = safelySetHeader(error, "X-Remix-Catch", "yes");
      return response;
    }

    if (isRouteErrorResponse(error)) {
      if (error) {
        handleError(error);
      }
      return errorResponseToJson(error, serverMode);
    }

    handleError(error);
    return returnLastResortErrorResponse(error, serverMode);
  }
}

function errorResponseToJson(
  errorResponse: ErrorResponse,
  serverMode: ServerMode
): Response {
  return routerJson(
    serializeError(
      // @ts-expect-error This is "private" from users but intended for internal use
      errorResponse.error || new Error("Unexpected Server Error"),
      serverMode
    ),
    {
      status: errorResponse.status,
      statusText: errorResponse.statusText,
      headers: {
        "X-Remix-Error": "yes",
      },
    }
  );
}

function returnLastResortErrorResponse(error: any, serverMode?: ServerMode) {
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

function unwrapResponse(response: Response) {
  let contentType = response.headers.get("Content-Type");
  // Check between word boundaries instead of startsWith() due to the last
  // paragraph of https://httpwg.org/specs/rfc9110.html#field.content-type
  return contentType && /\bapplication\/json\b/.test(contentType)
    ? response.body == null
      ? null
      : response.json()
    : response.text();
}

function createRemixRedirectResponse(
  response: Response,
  basename: string | undefined
) {
  // We don't have any way to prevent a fetch request from following
  // redirects. So we use the `X-Remix-Redirect` header to indicate the
  // next URL, and then "follow" the redirect manually on the client.
  let headers = new Headers(response.headers);
  let redirectUrl = headers.get("Location")!;
  headers.set(
    "X-Remix-Redirect",
    basename ? stripBasename(redirectUrl, basename) || redirectUrl : redirectUrl
  );
  headers.set("X-Remix-Status", String(response.status));
  headers.delete("Location");
  if (response.headers.get("Set-Cookie") !== null) {
    headers.set("X-Remix-Revalidate", "yes");
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}

// Anytime we are setting a header on a `Response` created in the loader/action,
// we have to so it in this manner since in an `undici` world, if the `Response`
// came directly from a `fetch` call, the headers are immutable will throw if
// we try to set a new header.  This is a sort of shallow clone of the `Response`
// so we can safely set our own header.
function safelySetHeader(
  response: Response,
  name: string,
  value: string
): Response {
  let headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
    duplex: response.body ? "half" : undefined,
  } as ResponseInit & { duplex?: "half" });
}
