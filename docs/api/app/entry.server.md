---
title: entry.server.js
---

Remix uses `app/entry.server.js` to generate the HTTP response when rendering on the server. The `default` export of this module is a function that lets you create the response, including HTTP status, headers, and HTML, giving you full control over the way the markup is generated and sent to the client.

This module should render the markup for the current page using a `<Remix>` element with the `context` and `url` for the current request. This markup will (optionally) be re-hydrated once JavaScript loads in the browser using the [browser entry module]("../browser-entry-module").

An example of how this is done can be found in [the Express starter repo](https://github.com/remix-run/starter-express/blob/master/app/entry.server.tsx).
