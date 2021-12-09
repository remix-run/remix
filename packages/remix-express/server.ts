import type {
  RequestInit as NodeRequestInit,
  Response as NodeResponse
} from "@remix-run/node";
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
import type * as express from "express";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action, such as
 * values that are generated by Express middleware like `req.session`.
 */
export interface GetLoadContextFunction {
  (req: express.Request, res: express.Response): AppLoadContext;
}

export type RequestHandler = ReturnType<typeof createRequestHandler>;

/**
 * Returns a request handler for Express that serves the response using Remix.
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

  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
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

      sendRemixResponse(res, response, abortController);
    } catch (error) {
      // Express doesn't support async functions, so we have to pass along the
      // error manually using next().
      next(error);
    }
  };
}

export function createRemixHeaders(
  requestHeaders: express.Request["headers"]
): NodeHeaders {
  let headers = new NodeHeaders();

  for (let [key, values] of Object.entries(requestHeaders)) {
    if (values) {
      if (Array.isArray(values)) {
        for (const value of values) {
          headers.append(key, value);
        }
      } else {
        headers.set(key, values);
      }
    }
  }

  return headers;
}

export function createRemixRequest(
  req: express.Request,
  abortController?: AbortController
): NodeRequest {
  let origin = `${req.protocol}://${req.get("host")}`;
  let url = new URL(req.url, origin);

  let init: NodeRequestInit = {
    method: req.method,
    headers: createRemixHeaders(req.headers),
    signal: abortController?.signal,
    abortController
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req; //req.pipe(new PassThrough({ highWaterMark: 16384 }));
  }

  return new NodeRequest(url.toString(), init);
}

function sendRemixResponse(
  res: express.Response,
  response: NodeResponse,
  abortController: AbortController
): void {
  res.status(response.status);

  for (let [key, values] of Object.entries(response.headers.raw())) {
    for (const value of values) {
      res.append(key, value);
    }
  }

  if (abortController.signal.aborted) {
    res.set("Connection", "close");
  }

  if (Buffer.isBuffer(response.body)) {
    res.end(response.body);
  } else if (response.body?.pipe) {
    response.body.pipe(res);
  } else {
    res.end();
  }
}
