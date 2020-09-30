import React from "react";
import ReactDOMServer from "react-dom/server";
import { Response } from "@remix-run/core";
import Remix from "@remix-run/react/server";

import App from "./components/App";

export default function handleRequest(
  request,
  responseStatusCode,
  remixContext
) {
  let markup = ReactDOMServer.renderToString(
    <Remix request={request} context={remixContext}>
      <App />
    </Remix>
  );

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: {
      "Content-Type": "text/html"
    }
  });
}
