import ReactDOMServer from "react-dom/server";
import { RemixServer } from "remix";
import type { EntryContext } from "remix";
import { Response } from "@remix-run/node";
import type { Headers } from "@remix-run/node";
import { PassThrough } from "stream";

type OnLoadersComplete = (fn: (entryContext: EntryContext) => void) => void;

export function streamDocument(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  onLoadersComplete: OnLoadersComplete
) {
  responseHeaders.set("Content-Type", "text/html");

  // PassThrough is a custom Duplex stream that just
  // passes any data we write to it straight through
  let output = new PassThrough();

  let response = new Response(output, {
    headers: responseHeaders
  });

  onLoadersComplete(remixContext => {
    let body = ReactDOMServer.renderToNodeStream(
      <RemixServer context={remixContext} url={request.url} />
    );
    body.pipe(output);
  });

  return response;
}

export function handleDataRequest(response: Response) {
  response.headers.set("x-hdr", "yes");
  return response;
}
