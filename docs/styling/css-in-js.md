---
title: CSS in JS
---

# CSS in JS libraries

Most CSS-in-JS approaches aren't recommended to be use in Remix because they require your app to render completely before you know what the styles are. This is a performance issue and prevents streaming features like [`defer`][defer].

Here's some sample code to show how you might use Styled Components with Remix (you can also \[find a runnable example in the Remix examples repository]\[styled-components-example]):

1. First you'll need to put a placeholder in your root component to control where the styles are inserted.

   ```tsx filename=app/root.tsx lines=[21-23]
   import {
     Links,
     LiveReload,
     Meta,
     Outlet,
     Scripts,
     ScrollRestoration,
   } from "@remix-run/react";

   export default function App() {
     return (
       <html lang="en">
         <head>
           <meta charSet="utf-8" />
           <meta
             name="viewport"
             content="width=device-width, initial-scale=1"
           />
           <Meta />
           <Links />
           {typeof document === "undefined"
             ? "__STYLES__"
             : null}
         </head>
         <body>
           <Outlet />
           <ScrollRestoration />
           <Scripts />
           <LiveReload />
         </body>
       </html>
     );
   }
   ```

2. Your `entry.server.tsx` will look something like this:

   ```tsx filename=entry.server.tsx lines=[7,16,19-24,26-27]
   import type {
     AppLoadContext,
     EntryContext,
   } from "@remix-run/node"; // or cloudflare/deno
   import { RemixServer } from "@remix-run/react";
   import { renderToString } from "react-dom/server";
   import { ServerStyleSheet } from "styled-components";

   export default function handleRequest(
     request: Request,
     responseStatusCode: number,
     responseHeaders: Headers,
     remixContext: EntryContext,
     loadContext: AppLoadContext
   ) {
     const sheet = new ServerStyleSheet();

     let markup = renderToString(
       sheet.collectStyles(
         <RemixServer
           context={remixContext}
           url={request.url}
         />
       )
     );
     const styles = sheet.getStyleTags();
     markup = markup.replace("__STYLES__", styles);

     responseHeaders.set("Content-Type", "text/html");

     return new Response("<!DOCTYPE html>" + markup, {
       status: responseStatusCode,
       headers: responseHeaders,
     });
   }
   ```

Other CSS-in-JS libraries will have a similar setup. If you've got a CSS framework working well with Remix, please \[contribute an example]\[examples]!

NOTE: You may run into hydration warnings when using Styled Components. Hopefully \[this issue]\[styled-components-issue] will be fixed soon.

[defer]: ../utils/defer
