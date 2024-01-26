import type { IncomingHttpHeaders, ServerResponse } from "node:http";
import { once } from "node:events";
import { Readable } from "node:stream";
import { splitCookiesString } from "set-cookie-parser";
import { createReadableStreamFromReadable } from "@remix-run/node";
import type * as Vite from "vite";

import invariant from "../invariant";

export type NodeRequestHandler = (
  req: Vite.Connect.IncomingMessage,
  res: ServerResponse
) => Promise<void>;

function fromNodeHeaders(nodeHeaders: IncomingHttpHeaders): Headers {
  let headers = new Headers();

  for (let [key, values] of Object.entries(nodeHeaders)) {
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
export function fromNodeRequest(
  nodeReq: Vite.Connect.IncomingMessage,
  useOriginalUrl: boolean
): Request {
  let origin =
    nodeReq.headers.origin && "null" !== nodeReq.headers.origin
      ? nodeReq.headers.origin
      : `http://${nodeReq.headers.host}`;
  invariant(nodeReq.url, 'Expected "req.url" to be defined');

  // Use `nodeReq.originalUrl` when a basename is present since it will have been
  // stripped from `url`
  // TODO (v3): It is probably safe to always use `originalUrl` but it could
  // technically be considered a breaking change if folks were relying on the
  // pre-remix-handler mutation of `req.url` so we can do that in v3
  let path = useOriginalUrl ? nodeReq.originalUrl : nodeReq.url;
  invariant(
    path,
    "Expected `nodeReq.originalUrl`/`rnodeReqeq.url` to be defined"
  );
  let url = new URL(path, origin);
  let init: RequestInit = {
    method: nodeReq.method,
    headers: fromNodeHeaders(nodeReq.headers),
  };

  if (nodeReq.method !== "GET" && nodeReq.method !== "HEAD") {
    init.body = createReadableStreamFromReadable(nodeReq);
    (init as { duplex: "half" }).duplex = "half";
  }

  return new Request(url.href, init);
}

// Adapted from solid-start's `handleNodeResponse`:
// https://github.com/solidjs/solid-start/blob/7398163869b489cce503c167e284891cf51a6613/packages/start/node/fetch.js#L162-L185
export async function toNodeRequest(res: Response, nodeRes: ServerResponse) {
  nodeRes.statusCode = res.status;
  nodeRes.statusMessage = res.statusText;

  let cookiesStrings = [];

  for (let [name, value] of res.headers) {
    if (name === "set-cookie") {
      cookiesStrings.push(...splitCookiesString(value));
    } else nodeRes.setHeader(name, value);
  }

  if (cookiesStrings.length) {
    nodeRes.setHeader("set-cookie", cookiesStrings);
  }

  if (res.body) {
    // https://github.com/microsoft/TypeScript/issues/29867
    let responseBody = res.body as unknown as AsyncIterable<Uint8Array>;
    let readable = Readable.from(responseBody);
    readable.pipe(nodeRes);
    await once(readable, "end");
  } else {
    nodeRes.end();
  }
}
