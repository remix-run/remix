/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */
import { PassThrough } from "node:stream";

import { createReadableStreamFromReadable } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";

const ABORT_DELAY = 5_000;

export default function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext,
  // This is ignored so we can keep it in the template for visibility.  Feel
  // free to delete this parameter in your app if you're not using it!
  // eslint-disable-next-line no-unused-vars
  loadContext
) {
  const isBot = isbot(request.headers.get("user-agent") || "");

  let status = responseStatusCode;
  const headers = new Headers(responseHeaders);
  headers.set("Content-Type", "text/html; charset=utf-8");

  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
        abortDelay={ABORT_DELAY}
      />,
      {
        onAllReady() {
          if (!isBot) return;

          resolve(
            new Response(
              createReadableStreamFromReadable(pipe(new PassThrough())),
              {
                headers,
                status,
              }
            )
          );
        },
        onShellReady() {
          shellRendered = true;

          if (isBot) return;

          resolve(
            new Response(
              createReadableStreamFromReadable(pipe(new PassThrough())),
              {
                headers,
                status,
              }
            )
          );
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          status = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
