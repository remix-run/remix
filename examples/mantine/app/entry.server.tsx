import { renderToString } from "react-dom/server";
import { RemixServer } from "remix";
import type { EntryContext } from "remix";
import { injectStylesIntoStaticMarkup } from "@mantine/ssr";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  responseHeaders.set("Content-Type", "text/html");

  return new Response(
    "<!DOCTYPE html>" + injectStylesIntoStaticMarkup(markup),
    {
      status: responseStatusCode,
      headers: responseHeaders
    }
  );
}
