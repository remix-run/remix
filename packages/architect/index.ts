import arc from "@architect/functions";
import { URL } from "url";
import {
  createAdapter,
  Request,
  createSession,
  createSessionFacade
} from "@remix-run/core";
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

  async sendPlatformResponse(
    remixResponse,
    remixSession
  ): Promise<ArcResponse> {
    // Don't write a cookie if the session object is empty. It always has
    // `iam` on it (that's why it's length > 1), need to look into this more,
    // docs don't talk about it.
    if (Object.keys(remixSession.mutableData).length > 1) {
      remixResponse.headers.append(
        "set-cookie",
        await arc.http.session.write(remixSession.mutableData)
      );
    }

    return {
      statusCode: remixResponse.status,
      headers: Object.fromEntries(remixResponse.headers),
      body: await remixResponse.text()
    };
  },

  async createRemixSession(enableSessions: boolean, req: ArcRequest) {
    if (enableSessions === false) {
      return createSessionFacade(
        "You need to enable sessions to use them. Enable with `createRequestHandler({ enableSessions: true })` in your Remix arc handler definition."
      );
    }

    let arcSession = await arc.http.session.read(req);
    return createSession(arcSession, () => {
      // TODO: Make sure this works for a `logout` situation
      // Delete everything but `iam`, which they seem to keep around always, not
      // a lot of documentation here
      arcSession = { iam: arcSession.iam };
    });
  }
});
