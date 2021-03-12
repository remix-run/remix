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

function createRemixRequest(req: NowRequest): Request {
  let host = req.headers["x-forwarded-host"] || req.headers["host"];
  let url = new URL(req.url!, `https://${host}`);

  let headers = new Headers();
  for (let key in req.headers) {
    let header = req.headers[key]!;
    // set-cookie is an array (maybe others)
    if (Array.isArray(header)) {
      for (let value of header) {
        headers.append(key, value);
      }
    } else {
      headers.append(key, header);
    }
  }

  let init: RequestInit = {
    method: req.method,
    headers: headers
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req;
  }

  return new Request(url.toString(), init);
}

function sendRemixResponse(res: NowResponse, response: Response): void {
  res.status(response.status);

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

  if (Buffer.isBuffer(response.body)) {
    res.end(response.body);
  } else {
    response.body.pipe(res);
  }
}
