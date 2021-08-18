import type {
  Request as ArcRequest,
  Response as ArcResponse
} from "@architect/functions";
import type {
  AppLoadContext,
  ServerBuild,
  ServerPlatform
} from "@remix-run/server-runtime";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import type { Response as NodeResponse } from "@remix-run/node";
import { Request as NodeRequest, formatServerError } from "@remix-run/node";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export interface GetLoadContextFunction {
  (req: ArcRequest): AppLoadContext;
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
}) {
  let platform: ServerPlatform = { formatServerError };
  let handleRequest = createRemixRequestHandler(build, platform, mode);

  return async (req: ArcRequest): Promise<ArcResponse> => {
    let request = createRemixRequest(req);
    let loadContext =
      typeof getLoadContext === "function" ? getLoadContext(req) : undefined;

    let response = ((await handleRequest(
      (request as unknown) as Request,
      loadContext
    )) as unknown) as NodeResponse;

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text()
    };
  };
}

function createRemixRequest(req: ArcRequest): NodeRequest {
  let host = req.headers["x-forwarded-host"] || req.headers.host;
  let search = req.rawQueryString.length ? "?" + req.rawQueryString : "";
  let url = new URL(req.rawPath + search, `https://${host}`);

  return new NodeRequest(url.toString(), {
    method: req.requestContext.http.method,
    headers: req.cookies
      ? { ...req.headers, Cookie: req.cookies.join(";") }
      : req.headers,
    body:
      req.body && req.isBase64Encoded
        ? Buffer.from(req.body, "base64").toString()
        : req.body
  });
}
