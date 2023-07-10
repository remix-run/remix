import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  AppLoadContext,
  ServerBuild,
  RequestInit as NodeRequestInit,
  Response as NodeResponse,
} from "@remix-run/node";
import {
  AbortController as NodeAbortController,
  createRequestHandler as createRemixRequestHandler,
  Headers as NodeHeaders,
  Request as NodeRequest,
  writeReadableStreamToWritable,
} from "@remix-run/node";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action.
 */
export type GetLoadContextFunction = (
  req: VercelRequest,
  res: VercelResponse
) => Promise<AppLoadContext> | AppLoadContext;

export type RequestHandler = (
  req: VercelRequest,
  res: VercelResponse
) => Promise<void>;

/**
 * Returns a request handler for Vercel's Node.js runtime that serves the
 * response using Remix.
 */
export function createRequestHandler({
  build,
  getLoadContext,
  mode = process.env.NODE_ENV,
}: {
  build: ServerBuild;
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
}): RequestHandler {
  let handleRequest = createRemixRequestHandler(build, mode);

  return async (req, res) => {
    let request = createRemixRequest(req, res);
    let loadContext = await getLoadContext?.(req, res);

    let response = (await handleRequest(request, loadContext)) as NodeResponse;

    await sendRemixResponse(res, response);
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
  res: VercelResponse
): NodeRequest {
  let host = req.headers["x-forwarded-host"] || req.headers["host"];
  // doesn't seem to be available on their req object!
  let protocol = req.headers["x-forwarded-proto"] || "https";
  let url = new URL(`${protocol}://${host}${req.url}`);

  // Abort action/loaders once we can no longer write a response
  let controller = new NodeAbortController();
  res.on("close", () => controller.abort());

  let init: NodeRequestInit = {
    method: req.method,
    headers: createRemixHeaders(req.headers),
    // Cast until reason/throwIfAborted added
    // https://github.com/mysticatea/abort-controller/issues/36
    signal: controller.signal as NodeRequestInit["signal"],
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req;
  }

  return new NodeRequest(url.href, init);
}

export async function sendRemixResponse(
  res: VercelResponse,
  nodeResponse: NodeResponse
): Promise<void> {
  res.statusMessage = nodeResponse.statusText;
  let multiValueHeaders = nodeResponse.headers.raw();
  res.writeHead(
    nodeResponse.status,
    nodeResponse.statusText,
    multiValueHeaders
  );

  if (nodeResponse.body) {
    await writeReadableStreamToWritable(nodeResponse.body, res);
  } else {
    res.end();
  }
}
