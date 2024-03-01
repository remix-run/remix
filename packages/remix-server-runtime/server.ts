import type {
  UNSAFE_DeferredData as DeferredData,
  ErrorResponse,
  StaticHandler,
  StaticHandlerContext,
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
import { encode } from "turbo-stream";

import type { AppLoadContext } from "./data";
import type { HandleErrorFunction, ServerBuild } from "./build";
import type { EntryContext } from "./entry";
import { createEntryRouteModules } from "./entry";
import { sanitizeErrors, serializeError, serializeErrors } from "./errors";
import { getDocumentHeadersRR as getDocumentHeaders } from "./headers";
import invariant from "./invariant";
import { ServerMode, isServerMode } from "./mode";
import type { RouteMatch } from "./routeMatching";
import { matchServerRoutes } from "./routeMatching";
import type { ServerRoute } from "./routes";
import { createStaticHandlerDataRoutes, createRoutes } from "./routes";
import {
  createDeferredReadableStream,
  isRedirectResponse,
  isResponse,
} from "./responses";
import { createServerHandoffString } from "./serverHandoff";
import { getDevServerHooks } from "./dev";

export type RequestHandler = (
  request: Request,
  loadContext?: AppLoadContext
) => Promise<Response>;

export type CreateRequestHandlerFunction = (
  build: ServerBuild | (() => ServerBuild | Promise<ServerBuild>),
  mode?: string
) => RequestHandler;

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

    let matches = matchServerRoutes(routes, url.pathname, _build.basename);
    let params = matches && matches.length > 0 ? matches[0].params : {};
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

    let response: Response;
    if (url.searchParams.has("_data")) {
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
      }
    } else if (
      _build.future.unstable_singleFetch &&
      url.pathname.endsWith(".data")
    ) {
      let handlerUrl = new URL(request.url);
      handlerUrl.pathname = handlerUrl.pathname
        .replace(/\.data$/, "")
        .replace(/^\/_root$/, "/");

      let matches = matchServerRoutes(
        routes,
        handlerUrl.pathname,
        _build.basename
      );

      response = await handleSingleFetchRequest(
        serverMode,
        _build,
        staticHandler,
        matches,
        request,
        handlerUrl,
        loadContext,
        handleError
      );

      if (_build.entry.module.handleDataRequest) {
        response = await _build.entry.module.handleDataRequest(response, {
          context: loadContext,
          params,
          request,
        });
      }
    } else if (
      matches &&
      matches[matches.length - 1].route.module.default == null &&
      matches[matches.length - 1].route.module.ErrorBoundary == null
    ) {
      response = await handleResourceRequest(
        serverMode,
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
      // We don't have any way to prevent a fetch request from following
      // redirects. So we use the `X-Remix-Redirect` header to indicate the
      // next URL, and then "follow" the redirect manually on the client.
      let headers = new Headers(response.headers);
      let redirectUrl = headers.get("Location")!;
      headers.set(
        "X-Remix-Redirect",
        build.basename
          ? stripBasename(redirectUrl, build.basename) || redirectUrl
          : redirectUrl
      );
      headers.set("X-Remix-Status", response.status);
      headers.delete("Location");
      if (response.headers.get("Set-Cookie") !== null) {
        headers.set("X-Remix-Revalidate", "yes");
      }

      return new Response(null, {
        status: 204,
        headers,
      });
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
    response.headers.set("X-Remix-Response", "yes");
    return response;
  } catch (error: unknown) {
    if (isResponse(error)) {
      error.headers.set("X-Remix-Catch", "yes");
      return error;
    }

    if (isRouteErrorResponse(error)) {
      if (error) {
        handleError(error);
      }
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

// IMPORTANT! Keep in sync with the types in @remix-run/react
type SingleFetchResult =
  | { data: unknown }
  | { error: unknown }
  | { redirect: string; status: number; revalidate: boolean; reload: boolean };
type SingleFetchResults = {
  [key: string]: SingleFetchResult;
};

async function handleSingleFetchRequest(
  serverMode: ServerMode,
  build: ServerBuild,
  staticHandler: StaticHandler,
  matches: RouteMatch<ServerRoute>[] | null,
  request: Request,
  handlerUrl: URL,
  loadContext: AppLoadContext,
  handleError: (err: unknown) => void
): Promise<Response> {
  let [result, headers, actionStatus] =
    request.method !== "GET"
      ? await singleFetchAction(
          request,
          handlerUrl,
          staticHandler,
          loadContext,
          handleError
        )
      : await singleFetchLoaders(
          handlerUrl,
          new URL(request.url).searchParams.get("_routes"),
          staticHandler,
          matches,
          loadContext,
          handleError,
          serverMode,
          build
        );

  // Mark all successful responses with a header so we can identify in-flight
  // network errors that are missing this header
  let resultHeaders = new Headers(headers);
  resultHeaders.set("X-Remix-Response", "yes");
  resultHeaders.set("Content-Type", "text/x-turbo");

  // Note: Deferred data is already just Promises, so we don't have to mess
  // `activeDeferreds` or anything :)
  return new Response(
    encode(result, [
      (value) => {
        if (value instanceof ErrorResponseImpl) {
          return ["ErrorResponse", { ...value }];
        }
      },
    ]),
    {
      status: actionStatus || 200,
      headers: resultHeaders,
    }
  );
}

async function singleFetchAction(
  request: Request,
  handlerUrl: URL,
  staticHandler: StaticHandler,
  loadContext: AppLoadContext,
  handleError: (err: unknown) => void
): Promise<[SingleFetchResult, Headers, number]> {
  try {
    let handlerRequest = new Request(handlerUrl, {
      method: request.method,
      body: request.body,
      headers: request.headers,
      signal: request.signal,
      ...(request.body ? { duplex: "half" } : undefined),
    });
    let response = await staticHandler.queryRoute(handlerRequest, {
      requestContext: loadContext,
    });
    // callRouteLoader/callRouteAction always return responses
    invariant(
      isResponse(response),
      "Expected a Response to be returned from queryRoute"
    );
    if (isRedirectResponse(response)) {
      return [
        {
          redirect: response.headers.get("Location")!,
          status: response.status,
          revalidate: response.headers.has("X-Remix-Revalidate"),
          reload: response.headers.has("X-Remix-Reload-Document"),
        },
        response.headers,
        200, // Don't trigger a redirect on the `fetch`
      ];
    }
    return [
      { data: await unwrapResponse(response) },
      response.headers,
      response.status,
    ];
  } catch (err) {
    handleError(err);
    let error = isResponse(err)
      ? new ErrorResponseImpl(
          err.status,
          err.statusText,
          await unwrapResponse(err)
        )
      : err;
    return [
      { error },
      new Headers(),
      isRouteErrorResponse(error) ? error.status : 500,
    ];
  }
}

async function singleFetchLoaders(
  handlerUrl: URL,
  routesToLoad: string | null,
  staticHandler: StaticHandler,
  matches: RouteMatch<ServerRoute>[] | null,
  loadContext: AppLoadContext,
  handleError: (err: unknown) => void,
  serverMode: ServerMode,
  build: ServerBuild
): Promise<[SingleFetchResults, Headers]> {
  let context: StaticHandlerContext;
  try {
    let handlerRequest = new Request(handlerUrl);
    let loadRouteIds = routesToLoad ? routesToLoad.split(",") : undefined;

    let result = await staticHandler.query(handlerRequest, {
      requestContext: loadContext,
      loadRouteIds,
    });
    if (isResponse(result)) {
      // We don't really know which loader this came from, so just stick it at
      // a known match
      let routeId =
        matches?.find((m) =>
          routesToLoad
            ? routesToLoad.split(",").includes(m.route.id)
            : m.route.module.loader
        )?.route.id || "root";
      return [
        {
          [routeId]: {
            redirect: result.headers.get("Location")!,
            status: result.status,
            revalidate: result.headers.has("X-Remix-Revalidate"),
            reload: result.headers.has("X-Remix-Reload-Document"),
          },
        },
        result.headers,
      ];
    }
    context = result;
  } catch (error: unknown) {
    handleError(error);
    return [{ root: { error } }, new Headers()];
  }

  // Sanitize errors outside of development environments
  if (context.errors) {
    Object.values(context.errors).forEach((err) => {
      // @ts-expect-error This is "private" from users but intended for internal use
      if (!isRouteErrorResponse(err) || err.error) {
        handleError(err);
      }
    });
    context.errors = sanitizeErrors(context.errors, serverMode);

    // TODO: Feels hacky - we need to un-bubble errors here since they'll be
    // bubbled client side.  Probably better to throw a flag on query() to not
    // do this in the first place
    let mostRecentError: [string, unknown] | null = null;
    for (let match of context.matches) {
      let routeId = match.route.id;
      if (context.errors[routeId] !== undefined) {
        mostRecentError = [routeId, context.errors[routeId]];
      }
      if (
        build.assets.routes[routeId]?.hasLoader &&
        context.loaderData[routeId] === undefined &&
        mostRecentError
      ) {
        context.errors[mostRecentError[0]] = undefined;
        context.errors[routeId] = mostRecentError[1];
        mostRecentError = null;
      }
    }
  }

  // Aggregate results based on the matches we intended to load since we get
  // `null` values back in `context.loaderData` for routes we didn't load
  let results: SingleFetchResults = {};
  let loadedMatches = routesToLoad
    ? context.matches.filter(
        (m) => m.route.loader && routesToLoad.split(",").includes(m.route.id)
      )
    : context.matches;
  loadedMatches.forEach((m) => {
    let data = context.loaderData?.[m.route.id];
    let error = context.errors?.[m.route.id];
    if (error !== undefined) {
      results[m.route.id] = { error };
    } else if (data !== undefined) {
      results[m.route.id] = { data };
    }
  });

  return [results, getDocumentHeaders(build, context)];
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

  // Sanitize errors outside of development environments
  if (context.errors) {
    Object.values(context.errors).forEach((err) => {
      // @ts-expect-error This is "private" from users but intended for internal use
      if (!isRouteErrorResponse(err) || err.error) {
        handleError(err);
      }
    });
    context.errors = sanitizeErrors(context.errors, serverMode);
  }

  let headers = getDocumentHeaders(build, context);

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
      url: context.location.pathname,
      basename: build.basename,
      criticalCss,
      future: build.future,
      isSpaMode: build.isSpaMode,
      ...(!build.future.unstable_singleFetch ? { state } : null),
    }),
    ...(build.future.unstable_singleFetch
      ? {
          serverHandoffStream: encode(state),
          renderMeta: { didRenderScripts: false },
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
        url: context.location.pathname,
        basename: build.basename,
        future: build.future,
        isSpaMode: build.isSpaMode,
        ...(!build.future.unstable_singleFetch ? { state } : null),
      }),
      ...(build.future.unstable_singleFetch
        ? {
            serverHandoffStream: encode(state),
            renderMeta: { didRenderScripts: false },
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
    invariant(
      !(DEFERRED_SYMBOL in response),
      `You cannot return a \`defer()\` response from a Resource Route.  Did you ` +
        `forget to export a default UI component from the "${routeId}" route?`
    );
    // callRouteLoader/callRouteAction always return responses
    invariant(
      isResponse(response),
      "Expected a Response to be returned from queryRoute"
    );
    return response;
  } catch (error: unknown) {
    if (isResponse(error)) {
      // Note: Not functionally required but ensures that our response headers
      // match identically to what Remix returns
      error.headers.set("X-Remix-Catch", "yes");
      return error;
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
