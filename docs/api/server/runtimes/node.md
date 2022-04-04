---
title: Node
order: 3
---

# @remix-run/node

This package contains all the [common server runtime](./common.md) utilities, implemented for Node.js.

It also contains utilities and polyfills for Node.js.

## Polyfills

Since Remix relies on browser API's such as fetch that are not natively available in Node.js you may find that your unit tests fail without these globals when running with tools such as Jest.

Your testing framework should provide you with a hook or location to polyfill globals / mock out API's; here you can add the following lines to install the globals that Remix relies on:

```ts
import { installGlobals } from "@remix-run/node";

// This installs globals such as "fetch", "Response", "Request" and "Headers".
installGlobals();
```

<docs-info>
  Keep in mind that we install these for you automatically in your actual app, so you should only need to do this in your test environment.
</docs-info>
