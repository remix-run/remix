import ReactDOMServer from "react-dom/server";
import { RemixServer } from "remix";
import 'dotenv/config';

export default function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext
) {

  let markup = ReactDOMServer.renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}
