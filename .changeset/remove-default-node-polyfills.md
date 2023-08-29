---
"@remix-run/dev": major
---

Remove default Node.js polyfills.

Any Node.js polyfills (or empty polyfills) that are required for your browser code must be configured via the `browserNodeBuiltinsPolyfill` option in `remix.config.js`.

```js
exports.browserNodeBuiltinsPolyfill = {
  modules: {
    buffer: true,
    fs: "empty",
  },
  globals: {
    Buffer: true,
  },
};
```

If you're targeting a non-Node.js server platform, any Node.js polyfills (or empty polyfills) that are required for your server code must be configured via the `serverNodeBuiltinsPolyfill` option in `remix.config.js`.

```js
exports.serverNodeBuiltinsPolyfill = {
  modules: {
    buffer: true,
    fs: "empty",
  },
  globals: {
    Buffer: true,
  },
};
```
