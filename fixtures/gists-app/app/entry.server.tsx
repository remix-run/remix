import ReactDOMServer from "react-dom/server";
import { RemixServer } from "remix";
import type { EntryContext } from "remix";
import { Response } from "@remix-run/node";
import type { Headers } from "@remix-run/node";
import { PassThrough } from "stream";

type GetRemixContext = () => Promise<{ context: EntryContext; status: number }>;

export function streamDocument(
  request: Request,
  responseHeaders: Headers,
  getRemixContext: GetRemixContext
) {
  responseHeaders.set("Content-Type", "text/html");

  let output = new PassThrough();

  let response = new Response(output, {
    headers: responseHeaders
  });

  getRemixContext().then(result => {
    if (result.status === 302) {
      // @ts-expect-error
      let location = result.headers.get("location");
      let body = ReactDOMServer.renderToNodeStream(
        <html>
          <head>
            <meta
              httpEquiv="refresh"
              content={`0;URL=${JSON.stringify(location)}`}
            />
          </head>
        </html>
      );
      body.pipe(output);
    } else {
      let body = ReactDOMServer.renderToNodeStream(
        <RemixServer context={result.context} url={request.url} />
      );
      body.pipe(output);
    }
  });

  return response;
}

export function handleDataRequest(response: Response) {
  response.headers.set("x-hdr", "yes");
  return response;
}
