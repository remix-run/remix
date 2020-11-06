import { URL } from "url";
import type * as express from "express";
import type {
  AppLoadContext,
  RemixConfig,
  RequestHandler as RemixRequestHandler,
  RequestInit,
  Response
} from "@remix-run/core";
import {
  Headers,
  Request,
  createRequestHandler as createRemixRequestHandler,
  readConfig as readRemixConfig
} from "@remix-run/core";

import "./fetchGlobals";

/**
 * A function that returns the `context` object for data loaders.
 */
export interface GetLoadContext {
  (req: express.Request, res: express.Response): AppLoadContext;
}

interface RequestHandler {
  (req: express.Request, res: express.Response): Promise<void>;
}

const nodeEnv = process.env.NODE_ENV || "development";

function handleConfigError(error: Error) {
  console.error(`There was an error reading the Remix config`);
  console.error(error);
  process.exit(1);
}

/**
 * Creates a request handler for Express that generates the response using
 * Remix routing and data loading.
 */
export function createRequestHandler({
  getLoadContext,
  root: remixRoot
}: {
  getLoadContext?: GetLoadContext;
  root?: string;
} = {}): RequestHandler {
  let handleRequest: RemixRequestHandler;
  let remixConfig: RemixConfig;
  let remixConfigPromise = readRemixConfig(remixRoot);

  // If there is a config error, catch it early and exit. But keep this function
  // sync in case they don't have top-level await (unflagged in node v14.8.0).
  remixConfigPromise.catch(handleConfigError);

  return async (req: express.Request, res: express.Response) => {
    if (!remixConfig) {
      try {
        remixConfig = await remixConfigPromise;
      } catch (error) {
        handleConfigError(error);
      }

      handleRequest = createRemixRequestHandler(remixConfig, nodeEnv);
    }

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
      res.end(remixRes.body);
    } else {
      remixRes.body.pipe(res);
    }
  };
}

function createRemixRequest(req: express.Request): Request {
  let origin = `${req.protocol}://${req.headers.host}`;
  let url = new URL(req.url, origin);

  let init: RequestInit = {
    method: req.method,
    headers: createRemixHeaders(req.headers)
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req;
  }

  return new Request(url.toString(), init);
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
