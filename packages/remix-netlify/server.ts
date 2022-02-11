import {
  // This has been added as a global in node 15+
  AbortController,
  formatServerError,
  Headers as NodeHeaders,
  Request as NodeRequest
} from "@remix-run/node";
import type {
  AppLoadContext,
  ServerBuild,
  ServerPlatform
} from "@remix-run/server-runtime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import type {
  Handler,
  HandlerEvent,
  HandlerContext,
  HandlerResponse
} from "@netlify/functions";
import type {
  Response as NodeResponse,
  RequestInit as NodeRequestInit
} from "@remix-run/node";

import { isBinaryType } from "./binary-types";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export interface GetLoadContextFunction {
  (event: HandlerEvent, context: HandlerContext): AppLoadContext;
}

export type RequestHandler = ReturnType<typeof createRequestHandler>;

export function createRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV
}: {
  build: ServerBuild;
  getLoadContext?: AppLoadContext;
  mode?: string;
}): Handler {
  let platform: ServerPlatform = { formatServerError };
  let handleRequest = createRemixRequestHandler(build, platform, mode);

  return async (event, context) => {
    let abortController = new AbortController();
    let request = createRemixRequest(event, abortController);
    let loadContext =
      typeof getLoadContext === "function"
        ? getLoadContext(event, context)
        : undefined;

    let response = (await handleRequest(
      request as unknown as Request,
      loadContext
    )) as unknown as NodeResponse;

    return sendRemixResponse(response, abortController);
  };
}

export function createRemixRequest(
  event: HandlerEvent,
  abortController?: AbortController
): NodeRequest {
  let url: URL;

  if (process.env.NODE_ENV !== "development") {
    url = new URL(event.rawUrl);
  } else {
    let origin = event.headers.host;
    let rawPath = getRawPath(event);
    url = new URL(rawPath, `http://${origin}`);
  }

  let init: NodeRequestInit = {
    method: event.httpMethod,
    headers: createRemixHeaders(event.multiValueHeaders),
    abortController,
    signal: abortController?.signal
  };

  if (event.httpMethod !== "GET" && event.httpMethod !== "HEAD" && event.body) {
    init.body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString()
      : event.body;
  }

  return new NodeRequest(url.href, init);
}

export function createRemixHeaders(
  requestHeaders: HandlerEvent["multiValueHeaders"]
): NodeHeaders {
  let headers = new NodeHeaders();

  for (const [key, values] of Object.entries(requestHeaders)) {
    if (values) {
      for (const value of values) {
        headers.append(key, value);
      }
    }
  }

  return headers;
}

// `netlify dev` doesn't return the full url in the event.rawUrl, so we need to create it ourselves
function getRawPath(event: HandlerEvent): string {
  let rawPath = event.path;
  let searchParams = new URLSearchParams();

  if (!event.multiValueQueryStringParameters) {
    return rawPath;
  }

  let paramKeys = Object.keys(event.multiValueQueryStringParameters);
  for (let key of paramKeys) {
    let values = event.multiValueQueryStringParameters[key];
    if (!values) continue;
    for (let val of values) {
      searchParams.append(key, val);
    }
  }

  let rawParams = searchParams.toString();

  if (rawParams) rawPath += `?${rawParams}`;

  return rawPath;
}

export async function sendRemixResponse(
  response: NodeResponse,
  abortController: AbortController
): Promise<HandlerResponse> {
  if (abortController.signal.aborted) {
    response.headers.set("Connection", "close");
  }

  let isBinary = isBinaryType(response.headers.get("content-type"));
  let isString = typeof response.body === "string";
  let isBuffer = response.body && response.body instanceof Buffer;
  let isBase64Encoded = isBuffer || (isBinary && isString);
  let body =
    isBuffer && isBinary
      ? Buffer.from(response.body as any).toString("base64")
      : await response.text();

  return {
    statusCode: response.status,
    multiValueHeaders: response.headers.raw(),
    body,
    isBase64Encoded
  };
}
