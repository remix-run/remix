import React from "./deps/react.ts";
import ReactDOMServer from "./deps/react-dom-server.ts";
import { RemixServer } from "./deps/@remix-run/react.ts";
import type { EntryContext } from "./deps/@remix-run/server-runtime.ts";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const markup = ReactDOMServer.renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
