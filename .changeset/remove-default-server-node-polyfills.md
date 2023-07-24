---
"@remix-run/dev": major
---

Remove default Node.js polyfills from the server build when targeting non-Node.js platforms.

Any Node.js polyfills that are required for your server code to run on non-Node.js platforms must be manually specified in `remix.config.js` using the `serverNodeBuiltinsPolyfill` option.

```js
exports.serverNodeBuiltinsPolyfill = {
  modules: {
    path: true, // Provide a JSPM polyfill
    fs: "empty", // Provide an empty polyfill
  },
};
```
