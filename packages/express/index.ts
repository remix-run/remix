import type * as express from "express";
import type { AppLoadContext, Response } from "@remix-run/core";
import {
  Headers,
  Request,
  createRequestHandler as createRemixRequestHandler
} from "@remix-run/core";

/**
 * Creates a request handler for Express that generates the response using
 * Remix routing and data loading.
 */
export function createRequestHandler({
  getLoadContext,
  root: remixRoot
}: {
  getLoadContext?: (
    req: express.Request,
    res: express.Response
  ) => AppLoadContext;
  root?: string;
} = {}): express.RequestHandler {
  let handleRequest = createRemixRequestHandler(remixRoot);

  return async (req: express.Request, res: express.Response) => {
    let loadContext: AppLoadContext;
    if (getLoadContext) {
      try {
        loadContext = await getLoadContext(req, res);
      } catch (error) {
        console.error(error);
        res.status(500).send();
        return;
      }
    }

    let remixReq = createRemixRequest(req);

    let remixRes: Response;
    try {
      remixRes = await handleRequest(remixReq, loadContext);
    } catch (error) {
      // This is probably an error in one of the loaders.
      console.error(error);
      res.status(500).send();
      return;
    }

    res.status(remixRes.status);

    for (let [key, value] of remixRes.headers.entries()) {
      res.set(key, value);
    }

    if (Buffer.isBuffer(remixRes.body)) {
      res.send(remixRes.body);
    } else {
      remixRes.body.pipe(res);
    }
  };
}

function createRemixRequest(req: express.Request): Request {
  let origin = `${req.protocol}://${req.headers.host}`;
  let url = new URL(req.url, origin);

  return new Request(url, {
    method: req.method,
    body: req,
    headers: createRemixHeaders(req.headers)
  });
}

function createRemixHeaders(
  requestHeaders: express.Request["headers"]
): Headers {
  return new Headers(
    Object.keys(requestHeaders).reduce((memo, key) => {
      let value = requestHeaders[key];

      if (typeof value === "string") {
        memo[key] = value;
      } else if (Array.isArray(value)) {
        memo[key] = value.join(",");
      }

      return memo;
    }, {} as { [headerName: string]: string })
  );
}
