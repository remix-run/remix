---
title: entry.server
toc: false
---

# entry.server

Remix uses `app/entry.server.tsx` (or `.jsx`) to generate the HTTP response when rendering on the server. The `default` export of this module is a function that lets you create the response, including HTTP status, headers, and HTML, giving you full control over the way the markup is generated and sent to the client.

This module should render the markup for the current page using a `<RemixServer>` element with the `context` and `url` for the current request. This markup will (optionally) be re-hydrated once JavaScript loads in the browser using the [browser entry module][browser-entry-module].

You can also export an optional `handleDataRequest` function that will allow you to modify the response of a data request. These are the requests that do not render HTML, but rather return the loader and action data to the browser once client side hydration has occurred.

Here's a basic example:

```tsx
import { renderToString } from "react-dom/server";
import type {
  EntryContext,
  HandleDataRequestFunction,
} from "@remix-run/node"; // or cloudflare/deno
import { RemixServer } from "@remix-run/react";

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

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}

// this is an optional export
export const handleDataRequest: HandleDataRequestFunction =
  (
    response: Response,
    // same args that get passed to the action or loader that was called
    { request, params, context }
  ) => {
    response.headers.set("x-custom", "yay!");
    return response;
  };
```

[browser-entry-module]: ./entry.client
