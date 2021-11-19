---
title: "@remix-run/node"
---

This contains utilities and polyfills for Node.js.

<docs-info>Most of the time you will never be importing from this package directly as it's used internally by adapters such as `@remix-run/express`.</docs-info>

## Polyfills

Since Remix relies on browser API's such as fetch that are not natively available in Node.js you may find that your unit tests fail without these globals when runing with tools such as Jest.

Your testing framework should provide you with a hook or location to polyfill globals / mock out API's; here you can add the following lines to install the globals that Remix relies on:

```ts
import { installGlobals } from "@remix-run/node";

// This installs globals such as "fetch", "Response", "Request" and "Headers.
installGlobals();
```

<docs-info>
  Keep in mind that we install these for you automatically in your actual app, so you should only need to do this in your test environment.
</docs-info>
