import type {
  AppLoadContext,
  ServerBuild,
  ServerPlatform
} from "@remix-run/server-runtime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import type {
  Response as NodeResponse,
  RequestInit as NodeRequestInit
} from "@remix-run/node";
import {
  // This has been added as a global in node 15+
  AbortController,
  formatServerError,
  Headers as NodeHeaders,
  Request as NodeRequest
} from "@remix-run/node";
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

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
  const platform: ServerPlatform = { formatServerError };
  const handleRequest = createRemixRequestHandler(build, platform, mode);

  return async (event, context) => {
    const abortController = new AbortController();
    const request = createRemixRequest(event, abortController);
    const loadContext =
      typeof getLoadContext === "function"
        ? getLoadContext(event, context)
        : undefined;

    const response = (await handleRequest(
      request as unknown as Request,
      loadContext
    )) as unknown as NodeResponse;

    if (abortController.signal.aborted) {
      response.headers.set("Connection", "close");
    }

    return {
      statusCode: response.status,
      multiValueHeaders: response.headers.raw(),
      body: await response.text()
    };
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
    const origin = event.headers.host;
    const rawPath = getRawPath(event);
    url = new URL(rawPath, `http://${origin}`);
  }

  const init: NodeRequestInit = {
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
  const headers = new NodeHeaders();

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
  const searchParams = new URLSearchParams();

  if (!event.multiValueQueryStringParameters) {
    return rawPath;
  }

  const paramKeys = Object.keys(event.multiValueQueryStringParameters);
  for (const key of paramKeys) {
    const values = event.multiValueQueryStringParameters[key];
    if (!values) continue;
    for (const val of values) {
      searchParams.append(key, val);
    }
  }

  const rawParams = searchParams.toString();

  if (rawParams) rawPath += `?${rawParams}`;

  return rawPath;
}
