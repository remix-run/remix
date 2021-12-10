import ReactDOMServer from "react-dom/server";
import { RemixServer } from "remix";
import type { EntryContext } from "remix";

export function streamDocument(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  onLoadersComplete: (fn: (entryContext: EntryContext) => void)
) {
  responseHeaders.set("Content-Type", "text/html");

  let response = new Response(undefined, {
    headers: responseHeaders
  });

  onLoadersComplete(remixContext=> {
    const { startWriting, abort } = pipeToNodeWritable(
      <RemixServer context={remixContext} url={request.url} />,
      response.body,
      {
        // this needs to change to some other method
        // like onStart or whatever
        onStartOrSomething() {
          startWriting();
        },
        onError(err: Error) {
          console.error(err)
        }
      }
    );
  });

  return response;
}

export function handleDataRequest(response: Response) {
  response.headers.set("x-hdr", "yes");
  return response;
}
