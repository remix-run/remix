import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  AppLoadContext,
  ServerBuild,
  ServerPlatform
} from "@remix-run/server-runtime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import type {
  RequestInit as NodeRequestInit,
  Response as NodeResponse
} from "@remix-run/node";
import {
  // This has been added as a global in node 15+
  AbortController,
  Headers as NodeHeaders,
  Request as NodeRequest,
  formatServerError
} from "@remix-run/node";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export interface GetLoadContextFunction {
  (req: VercelRequest, res: VercelResponse): AppLoadContext;
}

export type RequestHandler = ReturnType<typeof createRequestHandler>;

/**
 * Returns a request handler for Vercel's Node.js runtime that serves the
 * response using Remix.
 */
export function createRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
}) {
  let platform: ServerPlatform = { formatServerError };
  let handleRequest = createRemixRequestHandler(build, platform, mode);

  return async (req: VercelRequest, res: VercelResponse) => {
    let abortController = new AbortController();
    let request = createRemixRequest(req, abortController);
    let loadContext =
      typeof getLoadContext === "function"
        ? getLoadContext(req, res)
        : undefined;

    let response = (await handleRequest(
      request as unknown as Request,
      loadContext
    )) as unknown as NodeResponse;

    if (abortController.signal.aborted) {
      response.headers.set("Connection", "close");
    }

    sendRemixResponse(res, response);
  };
}

export function createRemixHeaders(
  requestHeaders: VercelRequest["headers"]
): NodeHeaders {
  let headers = new NodeHeaders();
  for (let key in requestHeaders) {
    let header = requestHeaders[key]!;
    // set-cookie is an array (maybe others)
    if (Array.isArray(header)) {
      for (let value of header) {
        headers.append(key, value);
      }
    } else {
      headers.append(key, header);
    }
  }

  return headers;
}

export function createRemixRequest(
  req: VercelRequest,
  abortController?: AbortController
): NodeRequest {
  let host = req.headers["x-forwarded-host"] || req.headers["host"];
  // doesn't seem to be available on their req object!
  let protocol = req.headers["x-forwarded-proto"] || "https";
  let url = new URL(req.url!, `${protocol}://${host}`);

  let init: NodeRequestInit = {
    method: req.method,
    headers: createRemixHeaders(req.headers),
    abortController,
    signal: abortController?.signal
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req;
  }

  return new NodeRequest(url.href, init);
}

function sendRemixResponse(res: VercelResponse, response: NodeResponse): void {
  let arrays = new Map();
  for (let [key, value] of response.headers.entries()) {
    if (arrays.has(key)) {
      let newValue = arrays.get(key).concat(value);
      res.setHeader(key, newValue);
      arrays.set(key, newValue);
    } else {
      res.setHeader(key, value);
      arrays.set(key, [value]);
    }
  }

  res.writeHead(response.status, response.headers.raw());

  if (Buffer.isBuffer(response.body)) {
    res.end(response.body);
  } else if (response.body?.pipe) {
    response.body.pipe(res);
  } else {
    res.end();
  }
}
