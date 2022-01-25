import {
  // This has been added as a global in node 15+
  AbortController,
  Headers as NodeHeaders,
  Request as NodeRequest,
  formatServerError
} from "@remix-run/node";
import type {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2
} from "aws-lambda";
import type {
  AppLoadContext,
  ServerBuild,
  ServerPlatform
} from "@remix-run/server-runtime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import type { Response as NodeResponse } from "@remix-run/node";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export interface GetLoadContextFunction {
  (event: APIGatewayProxyEventV2): AppLoadContext;
}

export type RequestHandler = ReturnType<typeof createRequestHandler>;

/**
 * Returns a request handler for Architect that serves the response using
 * Remix.
 */
export function createRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
}): APIGatewayProxyHandlerV2 {
  let platform: ServerPlatform = { formatServerError };
  let handleRequest = createRemixRequestHandler(build, platform, mode);

  return async (event, _context) => {
    let abortController = new AbortController();
    let request = createRemixRequest(event, abortController);
    let loadContext =
      typeof getLoadContext === "function" ? getLoadContext(event) : undefined;

    let response = (await handleRequest(
      request as unknown as Request,
      loadContext
    )) as unknown as NodeResponse;

    let cookies: string[] = [];

    // Arc/AWS API Gateway will send back set-cookies outside of response headers.
    for (let [key, values] of Object.entries(response.headers.raw())) {
      if (key.toLowerCase() === "set-cookie") {
        for (let value of values) {
          cookies.push(value);
        }
      }
    }

    if (cookies.length) {
      response.headers.delete("set-cookie");
    }

    if (abortController.signal.aborted) {
      response.headers.set("Connection", "close");
    }

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers),
      cookies,
      body: await response.text()
    };
  };
}

export function createRemixHeaders(
  requestHeaders: APIGatewayProxyEventHeaders,
  requestCookies?: string[]
): NodeHeaders {
  let headers = new NodeHeaders();

  for (let [header, value] of Object.entries(requestHeaders)) {
    if (value) {
      headers.append(header, value);
    }
  }

  if (requestCookies) {
    for (let cookie of requestCookies) {
      headers.append("Cookie", cookie);
    }
  }

  return headers;
}

export function createRemixRequest(
  event: APIGatewayProxyEventV2,
  abortController?: AbortController
): NodeRequest {
  let host = event.headers["x-forwarded-host"] || event.headers.host;
  let search = event.rawQueryString.length ? `?${event.rawQueryString}` : "";
  let url = new URL(event.rawPath + search, `https://${host}`);

  return new NodeRequest(url.href, {
    method: event.requestContext.http.method,
    headers: createRemixHeaders(event.headers, event.cookies),
    body:
      event.body && event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString()
        : event.body,
    abortController,
    signal: abortController?.signal
  });
}
