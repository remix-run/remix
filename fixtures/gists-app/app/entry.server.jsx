import ReactDOMServer from "react-dom/server";
import { RemixServer } from "remix";

export default function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext
) {
  let markup = ReactDOMServer.renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: {
      ...Object.fromEntries(responseHeaders),
      "Content-Type": "text/html"
    }
  });
}
