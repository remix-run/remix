import { URL } from "url";
import {
  createAdapter,
  Request,
  createSessionFacade,
  Headers
} from "@remix-run/core";
import type { RequestInit } from "@remix-run/core";

import "./fetchGlobals";

import type { NowRequest, NowResponse } from "@vercel/node";

export let createRequestHandler = createAdapter({
  createRemixRequest(req: NowRequest) {
    let host = req.headers["x-forwarded-host"] || req.headers["host"];
    let url = new URL(req.url!, `https://${host}`);

    let headers = new Headers();
    for (let key in req.headers) {
      let header = req.headers[key]!;
      // set-cookie is an array (maybe others)
      if (Array.isArray(header)) {
        for (let _header of header) {
          headers.append(key, _header);
        }
      } else {
        headers.append(key, header);
      }
    }

    let init: RequestInit = {
      method: req.method,
      headers: headers
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = req;
    }

    return new Request(url.toString(), init);
  },

  async sendPlatformResponse(
    remixResponse,
    _remixSession,
    _req,
    res: NowResponse
  ): Promise<void> {
    res.status(remixResponse.status);
    let arrays = new Map();
    for (let [key, value] of remixResponse.headers.entries()) {
      if (arrays.has(key)) {
        let newValue = arrays.get(key).concat(value);
        res.setHeader(key, newValue);
        arrays.set(key, newValue);
      } else {
        res.setHeader(key, value);
        arrays.set(key, [value]);
      }
    }

    if (Buffer.isBuffer(remixResponse.body)) {
      res.end(remixResponse.body);
    } else {
      remixResponse.body.pipe(res);
    }
  },

  createRemixSession() {
    return createSessionFacade(
      "Vercel does not have a built-in session API for Remix to wrap. For now you'll need to manage your own sessions with your own set-cookie and cookie headers. We will be adding built-in sessions support in the future."
    );
  }
});
