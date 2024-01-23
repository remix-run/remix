import type { IncomingHttpHeaders, ServerResponse } from "node:http";
import { once } from "node:events";
import { Readable } from "node:stream";
import { splitCookiesString } from "set-cookie-parser";
import {
  type ServerBuild,
  createReadableStreamFromReadable,
} from "@remix-run/node";
import { createRequestHandler as createBaseRequestHandler } from "@remix-run/server-runtime";
import type * as Vite from "vite";

import invariant from "../../invariant";

function createHeaders(requestHeaders: IncomingHttpHeaders) {
  let headers = new Headers();

  for (let [key, values] of Object.entries(requestHeaders)) {
    if (values) {
      if (Array.isArray(values)) {
        for (let value of values) {
          headers.append(key, value);
        }
      } else {
        headers.set(key, values);
      }
    }
  }

  return headers;
}

// Based on `createRemixRequest` in packages/remix-express/server.ts
function createRequest(
  req: Vite.Connect.IncomingMessage,
  res: ServerResponse,
  useOriginalUrl: boolean
): Request {
  let origin =
    req.headers.origin && "null" !== req.headers.origin
      ? req.headers.origin
      : `http://${req.headers.host}`;
  // Use `req.originalUrl` when a basename is present since it will have been
  // stripped from `url`
  // TODO (v3): It is probably safe to always use `originalUrl` but it could
  // technically be considered a breaking change if folks were relying on the
  // pre-remix-handler mutation of `req.url` so we can do that in v3
  let path = useOriginalUrl ? req.originalUrl : req.url;
  invariant(path, "Expected `req.originalUrl`/`req.url` to be defined");
  let url = new URL(path, origin);

  let init: RequestInit = {
    method: req.method,
    headers: createHeaders(req.headers),
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = createReadableStreamFromReadable(req);
    (init as { duplex: "half" }).duplex = "half";
  }

  return new Request(url.href, init);
}

// Adapted from solid-start's `handleNodeResponse`:
// https://github.com/solidjs/solid-start/blob/7398163869b489cce503c167e284891cf51a6613/packages/start/node/fetch.js#L162-L185
async function handleNodeResponse(webRes: Response, res: ServerResponse) {
  res.statusCode = webRes.status;
  res.statusMessage = webRes.statusText;

  let cookiesStrings = [];

  for (let [name, value] of webRes.headers) {
    if (name === "set-cookie") {
      cookiesStrings.push(...splitCookiesString(value));
    } else res.setHeader(name, value);
  }

  if (cookiesStrings.length) {
    res.setHeader("set-cookie", cookiesStrings);
  }

  if (webRes.body) {
    // https://github.com/microsoft/TypeScript/issues/29867
    let responseBody = webRes.body as unknown as AsyncIterable<Uint8Array>;
    let readable = Readable.from(responseBody);
    readable.pipe(res);
    await once(readable, "end");
  } else {
    res.end();
  }
}

export let createRequestHandler = (
  build: ServerBuild,
  { mode = "production" }: { mode?: string }
) => {
  let handler = createBaseRequestHandler(build, mode);
  return async (req: Vite.Connect.IncomingMessage, res: ServerResponse) => {
    let request = createRequest(req, res, build.basename != null);
    let response = await handler(request, {});
    handleNodeResponse(response, res);
  };
};
