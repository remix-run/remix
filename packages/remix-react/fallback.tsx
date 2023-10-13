import * as React from "react";
import { Links, Meta, Scripts } from "./components";

/**
 * When app's don't provide a root level Fallback, we default to this
 */
export function RemixRootDefaultFallback() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <p>Loading...</p>
        <Scripts />
      </body>
    </html>
  );
}
