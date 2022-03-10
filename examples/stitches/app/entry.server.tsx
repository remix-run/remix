import { renderToString } from "react-dom/server";
import { RemixServer } from "remix";
import type { EntryContext } from "remix";

import { getCssText } from "./styles/stitches.config";
import ServerStyleContext from "./styles/server.context";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  let sheet = getCssText();

  let markup = renderToString(
    <ServerStyleContext.Provider value={sheet}>
      <RemixServer context={remixContext} url={request.url} />
    </ServerStyleContext.Provider>
  );

  sheet = getCssText();
  markup = markup.replace(/<style id=\"stitches\">.*\<\/style>/g, `<style id="stitches">${sheet}</style>`);

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
