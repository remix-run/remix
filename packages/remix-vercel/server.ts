import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  AppLoadContext,
  ServerBuild,
  RequestInit as NodeRequestInit,
} from "@remix-run/node";
import {
  // This has been added as a global in node 15+
  AbortController,
  createRequestHandler as createRemixRequestHandler,
  Headers as NodeHeaders,
  Request as NodeRequest,
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
) => AppLoadContext;

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
    let abortController = new AbortController();
    let request = createRemixRequest(req, abortController);
    let loadContext =
      typeof getLoadContext === "function"
        ? getLoadContext(req, res)
        : undefined;

    let response = await handleRequest(
      request as unknown as Request,
      loadContext
    );

    if (abortController.signal.aborted) {
      response.headers.set("Connection", "close");
    }

    sendRemixResponse(res, response);
  };
}

export function createRemixHeaders(
  requestHeaders: VercelRequest["headers"]
): Headers {
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
    signal: abortController?.signal,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = new ReadableStream({
      start(controller) {
        req.on("data", (chunk) => {
          controller.enqueue(chunk);
        });
        req.on("end", () => {
          controller.close();
        });
      },
    });
  }

  return new NodeRequest(url.href, init);
}

export function sendRemixResponse(
  res: VercelResponse,
  nodeResponse: Response
): void {
  let arrays = new Map<string, string[]>();
  for (let [key, values] of Object.entries(
    (nodeResponse.headers as any).raw() as Record<string, string[]>
  )) {
    if (arrays.has(key)) {
      let newValue = arrays.get(key)!.concat(...values);
      res.setHeader(key, newValue);
      arrays.set(key, newValue);
    } else {
      res.setHeader(key, values);
      arrays.set(key, values);
    }
  }

  res.statusMessage = nodeResponse.statusText;
  let multiValueHeaders: Record<string, (string | string)[]> = {};
  for (let [key, value] of nodeResponse.headers) {
    if (typeof multiValueHeaders[key] === "undefined") {
      multiValueHeaders[key] = [value];
    } else {
      (multiValueHeaders[key] as string[]).push(value);
    }
  }
  res.writeHead(nodeResponse.status, multiValueHeaders);

  if (nodeResponse.body) {
    let reader = nodeResponse.body.getReader();
    async function read() {
      let { done, value } = await reader.read();
      if (done) {
        res.end(value);
        return;
      }

      res.write(value);
      read();
    }
    read();
  } else {
    res.end();
  }
}
