import { URL } from "url";
import type { AppLoadContext, RequestInit, ServerBuild } from "@remix-run/node";
import {
  Headers,
  Request,
  createRequestHandler as createRemixRequestHandler
} from "@remix-run/node";
import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

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
  let handleRequest = createRemixRequestHandler(build, mode);

  return async (event, context) => {
    let request = createRemixRequest(event);
    let loadContext =
      typeof getLoadContext === "function"
        ? getLoadContext(event, context)
        : undefined;

    let response = await handleRequest(request, loadContext);

    return {
      statusCode: response.status,
      multiValueHeaders: response.headers.raw(),
      body: await response.text()
    };
  };
}

export function createRemixRequest(event: HandlerEvent) {
  let host = event.headers["x-forwarded-host"] || event.headers.host;
  let rawPath = getRawPath(event);
  let url = new URL(rawPath, `https://${host}`);

  let init: RequestInit = {
    method: event.httpMethod,
    headers: createRemixHeaders(event.multiValueHeaders)
  };

  if (event.httpMethod !== "GET" && event.httpMethod !== "HEAD" && event.body) {
    init.body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString()
      : event.body;
  }

  return new Request(url.toString(), init);
}

export function createRemixHeaders(
  requestHeaders: HandlerEvent["multiValueHeaders"]
): Headers {
  let headers = new Headers();

  for (const [key, values] of Object.entries(requestHeaders)) {
    if (values) {
      for (const value of values) {
        headers.append(key, value);
      }
    }
  }

  return headers;
}

// TODO: Figure why netlify urls lose information?
function getRawPath(event: HandlerEvent) {
  let searchParams = new URLSearchParams();
  let paramKeys = event.queryStringParameters
    ? Object.keys(event.queryStringParameters)
    : [];

  for (const key of paramKeys) {
    let values = event.multiValueQueryStringParameters?.[key];
    if (values) {
      for (const value of values) {
        searchParams.append(key, value);
      }
    }
  }

  let rawPath = event.path;
  let rawParams = searchParams.toString();
  if (rawParams) rawParams += `?${rawParams}`;
  return rawPath;
}
