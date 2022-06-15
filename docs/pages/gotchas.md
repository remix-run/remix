---
title: Gotchas
---

# Gotchas

As we've built Remix, we've been laser focused on production results and scalability for your users and team working in it. Because of this, some developer experience and ecosystem compatibility issues exist that we haven't smoothed over yet.

This document should help you get over these bumps.

## Server Code in Client Bundles

You may run into this strange error in the browser. It almost always means that server code made it into browser bundles.

```
TypeError: Cannot read properties of undefined (reading 'root')
```

For example, you can't import "fs-extra" directly into a route module:

```jsx bad filename=app/routes/index.jsx lines=[2] nocopy
import { json } from "@remix-run/node"; // or "@remix-run/cloudflare"
import fs from "fs-extra";

export async function loader() {
  return json(await fs.pathExists("../some/path"));
}

export default function SomeRoute() {
  // ...
}
```

To fix it, move the import into a different module named `*.server.js` or `*.server.ts` and import from there. In our example here, we create a new file at `utils/fs-extra.server.js`:

```js filename=app/utils/fs-extra.server.js
export * from "fs-extra";
```

And then change our import in the route to the new "wrapper" module:

```jsx filename=app/routes/index.jsx lines=[3]
import { json } from "@remix-run/node"; // or "@remix-run/cloudflare"

import fs from "../utils/fs-extra.server";

export async function loader() {
  return json(await fs.pathExists("../some/path"));
}

export default function SomeRoute() {
  // ...
}
```

Even better, send a PR to the project to add `"sideEffects": false` to their package.json so that bundlers that tree shake know they can safely remove the code from browser bundles.

Similarly, you may run into the same error if you call a function at the top-level scope of your route module that depends on server-only code.

For example, [Remix upload handlers like `unstable_createFileUploadHandler` and `unstable_createMemoryUploadHandler`][remix-upload-handlers-like-unstable-create-file-upload-handler-and-unstable-create-memory-upload-handler] use Node globals under the hood and should only be called on the server. You can call either of these functions in a `*.server.js` or `*.server.ts` file, or you can move them into your route's `action` or `loader` function.

So instead of doing:

```jsx bad filename=app/routes/some-route.jsx lines=[3-6]
import { unstable_createFileUploadHandler } from "@remix-run/node"; // or "@remix-run/cloudflare"

const uploadHandler = unstable_createFileUploadHandler({
  maxPartSize: 5_000_000,
  file: ({ filename }) => filename,
});

export async function action() {
  // use `uploadHandler` here ...
}
```

You should be doing:

```jsx filename=app/routes/some-route.jsx good lines=[4-7]
import { unstable_createFileUploadHandler } from "@remix-run/node"; // or "@remix-run/cloudflare"

export async function action() {
  const uploadHandler = unstable_createFileUploadHandler({
    maxPartSize: 5_000_000,
    file: ({ filename }) => filename,
  });

  // use `uploadHandler` here ...
}
```

> Why does this happen?

Remix uses "tree shaking" to remove server code from browser bundles. Anything inside of Route module `loader`, `action`, and `headers` exports will be removed. It's a great approach but suffers from ecosystem compatibility.

When you import a third party module, Remix checks the `package.json` of that package for `"sideEffects": false`. If that is configured, Remix knows it can safely remove the code from the client bundles. Without it, the imports remain because code may depend on the module's side effects (like setting global polyfills, etc.).

## Importing ESM Packages

You may try importing an ESM-only package into your app and see an error like this when server rendering:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module /app/node_modules/dot-prop/index.js from /app/project/build/index.js not supported.
Instead change the require of /app/project/node_modules/dot-prop/index.js in /app/project/build/index.js to a dynamic import() which is available in all CommonJS modules.
```

To fix it, add the ESM package to the `serverDependenciesToBundle` option in your `remix.config.js` file.

In our case here we're using the `dot-prop` package, so we would do it like this:

```js filename=remix.config.js
module.exports = {
  serverDependenciesToBundle: ["dot-prop"],
  // ...
};
```

> Why does this happen?

Remix compiles your server build to CJS and doesn't bundle your node modules. CJS modules can't import ESM modules.

Adding packages to `serverDependenciesToBundle` tells Remix to bundle the ESM module directly into the server build instead of requiring it at runtime.

> Isn't ESM the future?

Yes! Our plan is to allow you to compile your app to ESM on the server. However, that will come with the reverse problem of not being able to import some CommonJS modules that are incompatible with being imported from ESM! So even when we get there, we may still need this configuration.

You may ask why we don't just bundle everything for the server. We could, but that will slow down builds and make production stack traces all point to a single file for your entire app. We don't want to do that. We know we can smooth this over eventually without making that tradeoff.

With major deployment platforms now supporting ESM server side, we're confident the future is brighter than the past here. We're still working on a solid dev experience for ESM server builds, our current approach relies on some things that you can't do in ESM. We'll get there.

## `typeof window` checks

Because the same JavaScript code can run in the browser as well as the server, sometimes you need to have a part of your code that only runs in one context or the other:

```ts bad
if (typeof window === "undefined") {
  // running in a server environment
} else {
  // running in a browser environment
}
```

This works fine in a Node.js environment, however, Deno actually supports `window`! So if you really want to check whether you're running in the browser, it's better to check for `document` instead:

```ts good
if (typeof document === "undefined") {
  // running in a server environment
} else {
  // running in a browser environment
}
```

This will work for all JS environments (Node.js, Deno, Workers, etc.).

[esbuild]: https://esbuild.github.io/

## Browser extensions injecting code

You may run into this warning in the browser:

```
Warning: Did not expect server HTML to contain a <script> in <html>.
```

This is a hydration warning from React, and is most likely due to one of your browser extensions injecting scripts into the server-rendered HTML, creating a difference with the resulting HTML.

Check out the page in incognito mode, the warning should disappear.

[remix-upload-handlers-like-unstable-create-file-upload-handler-and-unstable-create-memory-upload-handler]: ../api/remix#uploadhandler
