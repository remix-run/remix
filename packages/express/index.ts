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
  createSessionStub,
  readConfig as readRemixConfig
} from "@remix-run/core";

import "./fetchGlobals";
import invariant from "./invariant";

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
  root: remixRoot
}: {
  getLoadContext?: GetLoadContext;
  root?: string;
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

    let remixReq = createRemixRequest(req);

    let session = req.session
      ? createRemixSession(req)
      : createSessionStub(
          `You are trying to use sessions but you did not use a session middleware ` +
            `in your Express app, so this functionality is not available. Please use ` +
            `a session middleware such as \`express-session\` or \`cookie-session\` ` +
            `to enable sessions.`
        );

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

function createRemixSession(request: express.Request): Session {
  let flashPrefix = "__flash__:";
  let flash: { [name: string]: string } = {};

  invariant(
    request.session,
    `Cannot create a Remix session without a request session`
  );

  for (let key of Object.keys(request.session)) {
    if (key.startsWith(flashPrefix)) {
      flash[key.slice(flashPrefix.length)] = request.session[key];
      delete request.session[key];
    }
  }

  let expressSession = request.session;
  let session: Session = {
    set(name, value) {
      expressSession[name] = value;
    },
    flash(name, value) {
      expressSession[flashPrefix + name] = value;
    },
    unset(name) {
      delete expressSession[name];
    },
    get(name) {
      return expressSession[name] || flash[name];
    },
    destroy() {
      return new Promise((accept, reject) => {
        if (typeof expressSession.destroy === "function") {
          // express-session has a `destroy()` method
          (expressSession.destroy as ExpressSessionDestroy)(error => {
            if (error) {
              reject(error);
            } else {
              accept();
            }
          });
        } else {
          // cookie-session destroys by setting `request.session = null`
          request.session = null;
          accept();
        }
      });
    }
  };

  return session;
}
