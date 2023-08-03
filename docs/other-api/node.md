---
title: "@remix-run/node"
---

# `@remix-run/node`

This package contains utilities and polyfills for Node.js.

<docs-info>Most of the time you will never be importing from this package directly as it's used internally by adapters such as `@remix-run/express`.</docs-info>

## Polyfills

Since Remix relies on browser API's such as fetch that are not natively available in Node.js you may find that your unit tests fail without these globals when running with tools such as Jest.

Your testing framework should provide you with a hook or location to polyfill globals / mock out API's; here you can add the following lines to install the globals that Remix relies on:

```ts
import { installGlobals } from "@remix-run/node"; // or cloudflare/deno

// This installs globals such as "fetch", "Response", "Request" and "Headers".
installGlobals();
```

<docs-info>
  Keep in mind that we install these for you automatically in your actual app, so you should only need to do this in your test environment.
</docs-info>

## Version Support

Remix officially supports **Active** and **Maintenance** [Node LTS versions][node-releases] at any given time. When possible, we will try to align dropping support for Node versions that reach End of Life along with a Remix Major [SemVer][semver] release, but this is not something we plan to strictly enforce. If a Node version reaches End of Life and Remix is not in a place to perform a Major SemVer release in the same timeframe, we _may_ drop support in a Minor SemVer release and note it clearly in the release notes. In some cases, to avoid this, we may tactically drop support for a **Maintenance LTS** version early if it will reach End of Life shortly after a planned Remix Major release.

For example, Remix v2 is near completion and we hope to release it sometime in August 2023, however Node 16 reaches End of Life in September 2023, so we plan to drop support for Node 16 with the release of Remix v2.

[node-releases]: https://nodejs.dev/en/about/releases/
[semver]: https://semver.org/
