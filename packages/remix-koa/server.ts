import { PassThrough } from "stream";
import type * as koa from "koa";
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
  (ctx: koa.Context, next: koa.Next): AppLoadContext;
}

export type RequestHandler = ReturnType<typeof createRequestHandler>;

/**
 * Returns a request handler for Koa that serves the response using Remix.
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

  return async (ctx: koa.Context, next: koa.Next) => {
    let request = createRemixRequest(ctx);
    let loadContext =
      typeof getLoadContext === "function"
        ? getLoadContext(ctx, next)
        : undefined;

    let response = (await handleRequest(
      request as unknown as Request,
      loadContext
    )) as unknown as NodeResponse;

    sendRemixResponse(ctx, response);
  };
}

export function createRemixHeaders(
  requestHeaders: koa.Request["headers"]
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

export function createRemixRequest(ctx: koa.Context): NodeRequest {
  let origin = `${ctx.protocol}://${ctx.get("host")}`;
  let url = new URL(ctx.url, origin);

  let init: NodeRequestInit = {
    method: ctx.method,
    headers: createRemixHeaders(ctx.headers)
  };

  if (ctx.method !== "GET" && ctx.method !== "HEAD") {
    init.body = ctx.req.pipe(new PassThrough({ highWaterMark: 16384 }));
  }

  return new NodeRequest(url.toString(), init);
}

function sendRemixResponse(ctx: koa.Context, response: NodeResponse): void {
  ctx.status = response.status;

  for (let [key, values] of Object.entries(response.headers.raw())) {
    for (const value of values) {
      ctx.append(key, value);
    }
  }

  if (Buffer.isBuffer(response.body)) {
    ctx.body = response.body;
  } else if (response.body?.pipe) {
    response.body.pipe(ctx.res);
  }
}
