import { URL } from "url";
import type * as express from "express";
import type {
  AppLoadContext,
  RemixConfig,
  RequestHandler as RemixRequestHandler,
  RequestInit,
  Response,
  Session
} from "@remix-run/core";
import {
  FetchStream,
  Headers,
  Request,
  createRequestHandler as createRemixRequestHandler,
  createSession,
  createSessionFacade,
  readConfig as readRemixConfig
} from "@remix-run/core";

import "./fetchGlobals";
import { warnOnce } from "./warnings";

declare module "express" {
  interface Request {
    session?: { [key: string]: string } | null;
  }
}

/**
 * A function that returns the `context` object for data loaders.
 */
export interface GetLoadContext {
  (req: express.Request, res: express.Response): AppLoadContext;
}

interface RequestHandler {
  (req: express.Request, res: express.Response): Promise<void>;
}

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
  root: remixRoot,
  enableSessions = true
}: {
  getLoadContext?: GetLoadContext;
  root?: string;
  enableSessions?: boolean;
} = {}): RequestHandler {
  let handleRequest: RemixRequestHandler;
  let remixConfig: RemixConfig;
  let remixConfigPromise = readRemixConfig(remixRoot, process.env.NODE_ENV);

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

      handleRequest = createRemixRequestHandler(remixConfig);
    }

    warnOnce(
      !enableSessions || !!req.session,
      "Your Express app does not include a session middleware (or `req.session` " +
        "is falsy) so you won't be able to use sessions in your Remix data " +
        "loaders and actions. To enable sessions, please use a session middleware " +
        "such as `express-session` or `cookie-session`. Otherwise, use " +
        "`createRequestHandler({ enableSessions: false })` to silence this warning."
    );

    let remixReq = createRemixRequest(req);
    let session = createRemixSession(req);

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

    let remixRes: Response;
    try {
      remixRes = await handleRequest(remixReq, session, loadContext);
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
    let body = req.pipe(new FetchStream());
    init.body = (body as unknown) as NodeJS.ReadableStream;
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

interface ExpressSessionDestroy {
  (callback: (error?: Error) => void): void;
}

function createRemixSession(req: express.Request): Session {
  if (!req.session) {
    return createSessionFacade(
      "You are trying to use sessions but you did not use a session middleware " +
        "in your Express app, so this functionality is not available. Please use " +
        "a session middleware such as `express-session` or `cookie-session` " +
        "to enable sessions."
    );
  }

  return createSession(req.session, () => {
    return new Promise((accept, reject) => {
      if (req.session) {
        if (typeof req.session.destroy === "function") {
          (req.session.destroy as ExpressSessionDestroy)(error => {
            if (error) {
              reject(error);
            } else {
              accept();
            }
          });
        } else {
          req.session = null;
          accept();
        }
      } else {
        accept();
      }
    });
  });
}
