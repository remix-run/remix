---
title: "@remix-run/node"
---

# `@remix-run/node`

This package contains utilities and polyfills for Node.js.

## Polyfills

Since Remix relies on browser APIs such as `fetch` that aren't natively & stably available yet in Node.js you may find that your unit tests fail without these globals when running with tools such as Jest.

Your testing framework should provide you with a hook or location to polyfill globals / mock out APIs; here you can add the following lines to install the globals that Remix relies on:

```ts
import { installGlobals } from "@remix-run/node";

// This installs globals such as "fetch", "Response", "Request" and "Headers".
installGlobals();
```

<docs-info>
  Keep in mind that we install these for you automatically in your actual app, so you should only need to do this in your test environment.
</docs-info>

## Version Support

Remix officially supports **Active** and **Maintenance** [Node LTS versions][node-releases] at any given point in time. Dropped support for End of Life Node versions is done in a Remix Minor release.

[node-releases]: https://nodejs.org/en/about/previous-releases
