import { URL } from "url";
import {
  createAdapter,
  Request,
  createSessionFacade,
  Headers
} from "@remix-run/core";

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

    return new Request(url.toString(), {
      method: req.method,
      headers: headers,
      body: req.body
    });
  },

  async sendPlatformResponse(
    remixResponse,
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
    res.send(await remixResponse.text());
  },

  createRemixSession() {
    return createSessionFacade(
      "Vercel does not have a built-in session API for Remix to wrap. For now you'll need to manage your own sessions with your own set-cookie and cookie headers. We will be adding built-in sessions support in the future."
    );
  }
});
