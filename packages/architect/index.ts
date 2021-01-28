import { URL } from "url";
import { createAdapter, Request } from "@remix-run/core";

import "./fetchGlobals";

import type {
  Request as ArcRequest,
  Response as ArcResponse
} from "@architect/functions";

export let createRequestHandler = createAdapter({
  createRemixRequest(req: ArcRequest) {
    let host = req.headers["x-forwarded-host"] || req.headers.host;
    let search = req.rawQueryString.length ? "?" + req.rawQueryString : "";
    let url = new URL(req.rawPath + search, `https://${host}`);

    return new Request(url.toString(), {
      method: req.requestContext.http.method,
      headers: req.headers,
      body:
        req.body && req.isBase64Encoded
          ? Buffer.from(req.body, "base64").toString()
          : req.body
    });
  },

  async sendPlatformResponse(remixResponse): Promise<ArcResponse> {
    return {
      statusCode: remixResponse.status,
      headers: Object.fromEntries(remixResponse.headers),
      body: await remixResponse.text()
    };
  }
});
