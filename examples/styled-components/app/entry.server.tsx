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

  // collecting styles

    renderToString(
        sheet.collectStyles(
          <StylesContext.Provider value={null}>
            <RemixServer context={remixContext} url={request.url} />
          </StylesContext.Provider>
        )
      );

  // Now that we've rendered, we get the styles out of the sheet
    let styles = sheet.getStyleTags().replace(/(<([^>]+)>)/gi, ""); //removing  the <style> tags
    sheet.seal();

  //Now Rendering the extracted styles 

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
