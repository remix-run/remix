import type * as express from "express";
import type { HeadersInit, LoaderContext } from "@remix-run/core";
import {
  Request,
  createRequestHandler as createRemixRequestHandler
} from "@remix-run/core";

function createRemixRequest(req: express.Request): Request {
  let headers = Object.keys(req.headers).reduce((memo, key) => {
    let value = req.headers[key];

    if (typeof value === "string") {
      memo[key] = value;
    } else if (Array.isArray(value)) {
      memo[key] = value.join(",");
    }

    return memo;
  }, {} as HeadersInit);

  return new Request(req.url, {
    body: req,
    headers: headers,
    method: req.method,
    referrer: req.headers.referer
  });
}

/**
 * Creates a request handler for Express that generates the response using
 * Remix routing and data loading.
 */
export default function createRequestHandler({
  remixRoot
}: {
  remixRoot?: string;
}): express.RequestHandler {
  let handleRequest = createRemixRequestHandler(remixRoot);

  return async (req: express.Request, res: express.Response) => {
    let remixReq = createRemixRequest(req);

    let remixRes;
    try {
      remixRes = await handleRequest(remixReq);
    } catch (error) {
      // This is probably an error in one of the loaders.
      console.error(error);
      // TODO: Show nicer error page
      res.status(500).send();
      return;
    }

    res.status(remixRes.status).set(remixRes.headers);

    if (typeof remixRes.body === "string" || Buffer.isBuffer(remixRes.body)) {
      res.send(remixRes.body);
    } else {
      remixRes.body.pipe(res);
    }
  };
}
