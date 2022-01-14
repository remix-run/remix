import ReactDOMServer from "react-dom/server";
import { renderToString } from "react-dom/server";
import { RemixServer } from "remix";
import StylesContext from "./StylesContext";
import { createStitches } from "@stitches/react";
import type { EntryContext } from "remix";

const { getCssText } = createStitches();

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  renderToString(
    <StylesContext.Provider value={null}>
      <RemixServer context={remixContext} url={request.url} />
    </StylesContext.Provider>
  );

  const markup = ReactDOMServer.renderToString(
    <StylesContext.Provider value={getCssText()}>
      <RemixServer context={remixContext} url={request.url} />
    </StylesContext.Provider>
  );

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}
