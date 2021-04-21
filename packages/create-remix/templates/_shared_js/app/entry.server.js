import ReactDOMServer from "react-dom/server";
import { RemixServer as Remix } from "@remix-run/react";

export default function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext
) {
  let markup = ReactDOMServer.renderToString(
    <Remix context={remixContext} url={request.url} />
  );

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: {
      ...Object.fromEntries(responseHeaders),
      "Content-Type": "text/html"
    }
  });
}
