import { URL } from "url";
import type * as express from "express";
import type { RequestInit } from "@remix-run/core";
import {
  createAdapter,
  Headers,
  Request,
  createSession,
  createSessionFacade,
  warnOnce
} from "@remix-run/core";

import "./fetchGlobals";

declare module "express" {
  interface Request {
    session?: { [key: string]: string } | null;
  }
}

interface ExpressSessionDestroy {
  (callback: (error?: Error) => void): void;
}

export let createRequestHandler = createAdapter({
  createRemixRequest(req: express.Request) {
    let origin = `${req.protocol}://${req.hostname}`;
    let url = new URL(req.url, origin);

    let init: RequestInit = {
      method: req.method,
      headers: createRemixHeaders(req.headers)
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = req;
    }

    return new Request(url.toString(), init);
  },

  sendPlatformResponse(remixResponse, _session, _req, res: express.Response) {
    res.status(remixResponse.status);

    for (let [key, value] of remixResponse.headers.entries()) {
      res.set(key, value);
    }

    if (Buffer.isBuffer(remixResponse.body)) {
      res.end(remixResponse.body);
    } else {
      remixResponse.body.pipe(res);
    }
  },

  createRemixSession(enableSessions: boolean, req: express.Request) {
    warnOnce(
      !enableSessions || !!req.session,
      "Your Express app does not include a session middleware (or `req.session` " +
        "is falsy) so you won't be able to use sessions in your Remix data " +
        "loaders and actions. To enable sessions, please use a session middleware " +
        "such as `express-session` or `cookie-session`. Otherwise, use " +
        "`createRequestHandler({ enableSessions: false })` to silence this warning."
    );

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
});

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
