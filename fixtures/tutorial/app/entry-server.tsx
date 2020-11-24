import React from "react";
import ReactDOMServer from "react-dom/server";
import type { EntryContext } from "@remix-run/core";
import Remix from "@remix-run/react/server";

import App from "./App";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  let markup = ReactDOMServer.renderToString(
    <Remix context={remixContext} url={request.url}>
      <App />
    </Remix>
  );

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: {
      ...Object.fromEntries(responseHeaders),
      "Content-Type": "text/html"
    }
  });
}
