import type {
  AzureFunction,
  Context,
  HttpRequest,
  HttpRequestHeaders,
} from "@azure/functions";
import {
  createRequestHandler as createRemixRequestHandler,
  Headers as NodeHeaders,
  Request as NodeRequest,
} from "@remix-run/node";
import type {
  AppLoadContext,
  ServerBuild,
  Response as NodeResponse,
  RequestInit as NodeRequestInit,
} from "@remix-run/node";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action, such as
 * values that are generated by Express middleware like `req.session`.
 */
export type GetLoadContextFunction = (req: HttpRequest) => AppLoadContext;

export type RequestHandler = AzureFunction;

export function createRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV,
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
}): RequestHandler {
  let handleRequest = createRemixRequestHandler(build, mode);

  return async (_context: Context, req: HttpRequest) => {
    let request = createRemixRequest(req);
    let loadContext = getLoadContext ? getLoadContext(req) : undefined;

    let response = (await handleRequest(
      request as unknown as Request,
      loadContext
    )) as unknown as NodeResponse;

    return {
      status: response.status,
      headers: response.headers.raw(),
      body: await response.text(),
    };
  };
}

export function createRemixHeaders(
  requestHeaders: HttpRequestHeaders
): NodeHeaders {
  let headers = new NodeHeaders();

  for (let [key, value] of Object.entries(requestHeaders)) {
    if (!value) continue;
    headers.set(key, value);
  }

  return headers;
}

export function createRemixRequest(req: HttpRequest): NodeRequest {
  let url = req.headers["x-ms-original-url"]!;

  let init: NodeRequestInit = {
    method: req.method || "GET",
    headers: createRemixHeaders(req.headers),
  };

  if (req.body && !["HEAD", "GET"].includes(req.method)) {
    init.body = req.body;
  }

  return new NodeRequest(url, init);
}
