---
title: entry.server
toc: false
---

# entry.server

By default, Remix will handle generating the HTTP Response for you. If you want to customize this behavior, you can run `npx remix reveal` to generate a `app/entry.server.tsx` (or `.jsx`) that will take precedence. The `default` export of this module is a function that lets you create the response, including HTTP status, headers, and HTML, giving you full control over the way the markup is generated and sent to the client.

This module should render the markup for the current page using a `<RemixServer>` element with the `context` and `url` for the current request. This markup will (optionally) be re-hydrated once JavaScript loads in the browser using the [browser entry module][browser-entry-module].

You can also export an optional `handleDataRequest` function that will allow you to modify the response of a data request. These are the requests that do not render HTML, but rather return the loader and action data to the browser once client-side hydration has occurred.

[browser-entry-module]: ./entry.client
