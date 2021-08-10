import { URL } from "url";
import type { ServerBuild, AppLoadContext } from "@remix-run/node";
import {
  Headers,
  Request,
  createRequestHandler as createRemixRequestHandler
} from "@remix-run/node";
import {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2
} from "aws-lambda";

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
  getLoadContext: GetLoadContextFunction;
  mode?: string;
}): APIGatewayProxyHandlerV2 {
  let handleRequest = createRemixRequestHandler(build, mode);

  return async (event, _context) => {
    let request = createRemixRequest(event);
    let loadContext =
      typeof getLoadContext === "function" ? getLoadContext(event) : undefined;

    let response = await handleRequest(request, loadContext);

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text()
    };
  };
}

export function createRemixHeaders(
  requestHeaders: APIGatewayProxyEventHeaders,
  requestCookies?: string[]
): Headers {
  let headers = new Headers();

  for (let [header, value] of Object.entries(requestHeaders)) {
    if (value) {
      headers.append(header, value);
    }
  }

  if (requestCookies) {
    for (const cookie of requestCookies) {
      headers.append("Cookie", cookie);
    }
  }

  return headers;
}

export function createRemixRequest(event: APIGatewayProxyEventV2): Request {
  let host = event.headers["x-forwarded-host"] || event.headers.host;
  let proto = event.headers["x-forwarded-proto"] || "https";
  let search = event.rawQueryString.length ? `?${event.rawQueryString}` : "";
  let url = new URL(event.rawPath + search, `${proto}://${host}`);

  return new Request(url.toString(), {
    method: event.requestContext.http.method,
    headers: createRemixHeaders(event.headers, event.cookies),
    body:
      event.body && event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString()
        : event.body
  });
}
