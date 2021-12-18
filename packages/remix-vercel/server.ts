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
  const platform: ServerPlatform = { formatServerError };
  const handleRequest = createRemixRequestHandler(build, platform, mode);

  return async (req: VercelRequest, res: VercelResponse) => {
    const abortController = new AbortController();
    const request = createRemixRequest(req, abortController);
    const loadContext =
      typeof getLoadContext === "function"
        ? getLoadContext(req, res)
        : undefined;

    const response = (await handleRequest(
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
  const headers = new NodeHeaders();
  for (const key in requestHeaders) {
    const header = requestHeaders[key]!;
    // set-cookie is an array (maybe others)
    if (Array.isArray(header)) {
      for (const value of header) {
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
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  // doesn't seem to be available on their req object!
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const url = new URL(req.url!, `${protocol}://${host}`);

  const init: NodeRequestInit = {
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
  const arrays = new Map();
  for (const [key, value] of response.headers.entries()) {
    if (arrays.has(key)) {
      const newValue = arrays.get(key).concat(value);
      res.setHeader(key, newValue);
      arrays.set(key, newValue);
    } else {
      res.setHeader(key, value);
      arrays.set(key, [value]);
    }
  }

  res.writeHead(response.status, response.headers.raw());

  if (Buffer.isBuffer(response.body)) {
    return res.end(response.body);
  } else if (response.body?.pipe) {
    return res.end(response.body.pipe(res));
  }

  return res.end();
}
