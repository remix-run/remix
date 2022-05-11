import { renderToReadableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import type { EntryContext } from "@remix-run/cloudflare";

export function handleDataRequest(response: Response) {
  console.log(response);
  return response;
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  let didError = false;

  let body = await renderToReadableStream(
    <RemixServer context={remixContext} url={request.url} />,
    {
      signal: request.signal,
      onError(error) {
        didError = true;
        console.error(error);
      },
    }
  );

  return new Response(body, {
    status: didError ? 500 : responseStatusCode,
    headers: responseHeaders,
  });
}
