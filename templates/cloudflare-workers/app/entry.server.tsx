import type { EntryContext } from "@remix-run/cloudflare";
import { RemixServer } from "@remix-run/react";
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  let controller = new AbortController();
  let didError = false;
  try {
    const stream = await renderToReadableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        signal: controller.signal,
        onError(error: unknown) {
          didError = true;
          console.error(error);
        }
      }
    );
  
    responseHeaders.set("Content-Type", "text/html");
  
    return new Response(stream, {
      status: didError ? 500 : responseStatusCode,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown Error";
    return new Response(
      `<!doctype html><p>An error ocurred:</p><pre>${message}</pre>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}
