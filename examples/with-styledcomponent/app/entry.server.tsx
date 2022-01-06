import ReactDOMServer,{renderToString} from "react-dom/server";

import { RemixServer } from "remix";
import type { EntryContext } from "remix";
import { ServerStyleSheet } from "styled-components";

import StylesContext from "./stylesContext";
export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {

  const sheet = new ServerStyleSheet();

    renderToString(
        sheet.collectStyles(
          <StylesContext.Provider value={null}>
            <RemixServer context={remixContext} url={request.url} />
          </StylesContext.Provider>
        )
      );

  let styles = sheet.getStyleTags().replace(/(<([^>]+)>)/gi, "");
  sheet.seal();

  let markup = ReactDOMServer.renderToString(
    <StylesContext.Provider value={styles}>
      <RemixServer context={remixContext} url={request.url} />
    </StylesContext.Provider>
  );
  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
