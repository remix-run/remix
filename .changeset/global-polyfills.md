---
"@remix-run/dev": minor
---

The `serverNodeBuiltinsPolyfill` option (along with the newly added `browserNodeBuiltinsPolyfill`) now supports defining global polyfills in addition to module polyfills.

For example, to polyfill Node's `Buffer` global:

```js
module.exports = {
  serverNodeBuiltinsPolyfill: {
    globals: {
      Buffer: true,
    },
    // You'll probably need to polyfill the "buffer" module
    // too since the global polyfill imports this:
    modules: {
      buffer: true,
    },
  },
};
```
