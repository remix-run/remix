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
  let init: RequestInit = {
    method: event.httpMethod,
    headers: createRemixHeaders(event.multiValueHeaders)
  };

  if (event.httpMethod !== "GET" && event.httpMethod !== "HEAD" && event.body) {
    init.body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString()
      : event.body;
  }

  return new Request(event.rawUrl, init);
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
