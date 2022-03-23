import { renderToString } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import type { EntryContext } from "@remix-run/node";

import { getCssText } from "./styles/stitches.config";
import ServerStyleContext from "./styles/server.context";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const sheet = getCssText();

  let markup = renderToString(
    <ServerStyleContext.Provider value={sheet}>
      <RemixServer context={remixContext} url={request.url} />
    </ServerStyleContext.Provider>
  );

  markup = markup.replace("__STYLES__", sheet);

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
