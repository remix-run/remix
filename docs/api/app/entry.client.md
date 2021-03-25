---
title: entry.client.js
---

Remix uses `app/entry.client.js` as the entry point for the browser bundle. This module gives you full control over the "hydrate" step after JavaScript loads into the document.

Typically this module uses `ReactDOM.hydrate` to re-hydrate the markup that was already generated on the server in your [server entry module]("../server-entry-module").

An example of how this is done can be found in [the Express starter repo](https://github.com/remix-run/starter-express/blob/master/app/entry.client.tsx).
