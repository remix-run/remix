import { URL } from "url";
import type { NowRequest, NowResponse } from "@vercel/node";
import type {
  AppLoadContext,
  RequestInit,
  Response,
  ServerBuild
} from "@remix-run/node";
import {
  Headers,
  Request,
  createRequestHandler as createRemixRequestHandler
} from "@remix-run/node";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export interface GetLoadContextFunction {
  (req: NowRequest, res: NowResponse): AppLoadContext;
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
  let handleRequest = createRemixRequestHandler(build, mode);

  return async (req: NowRequest, res: NowResponse) => {
    let request = createRemixRequest(req);
    let loadContext =
      typeof getLoadContext === "function"
        ? getLoadContext(req, res)
        : undefined;

    let response = await handleRequest(request, loadContext);

    sendRemixResponse(res, response);
  };
}

export function createRemixHeaders(
  requestHeaders: NowRequest["headers"]
): Headers {
  let headers = new Headers();
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

export function createRemixRequest(req: NowRequest): Request {
  let host = req.headers["x-forwarded-host"] || req.headers["host"];
  // doesn't seem to be available on their req object!
  let protocol = req.headers["x-forwarded-proto"] || "https";
  let url = new URL(req.url!, `${protocol}://${host}`);

  let init: RequestInit = {
    method: req.method,
    headers: createRemixHeaders(req.headers)
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req;
  }

  return new Request(url.toString(), init);
}

function sendRemixResponse(res: NowResponse, response: Response): void {
  res.status(response.status);

  if (Buffer.isBuffer(response.body)) {
    res.writeHead(response.status, response.headers.raw()).end(response.body);
  } else {
    res
      .writeHead(response.status, response.headers.raw())
      .end(response.body.pipe(res));
  }
}
