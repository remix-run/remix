import { PassThrough } from "stream";
import { URL } from "url";
import type * as express from "express";
import type { RequestInit } from "@remix-run/core";
import { createAdapter, Headers, Request } from "@remix-run/core";

import "./fetchGlobals";

export let createRequestHandler = createAdapter({
  createRemixRequest(req: express.Request) {
    let origin = `${req.protocol}://${req.hostname}`;
    let url = new URL(req.url, origin);

    let init: RequestInit = {
      method: req.method,
      headers: createRemixHeaders(req.headers)
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = req.pipe(new PassThrough({ highWaterMark: 16384 }));
    }

    return new Request(url.toString(), init);
  },

  sendPlatformResponse(remixResponse, _req, res: express.Response) {
    res.status(remixResponse.status);

    for (let [key, value] of remixResponse.headers.entries()) {
      res.set(key, value);
    }

    if (Buffer.isBuffer(remixResponse.body)) {
      res.end(remixResponse.body);
    } else {
      remixResponse.body.pipe(res);
    }
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
