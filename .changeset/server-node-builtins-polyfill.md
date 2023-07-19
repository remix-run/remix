---
"@remix-run/dev": minor
---

Add `serverNodeBuiltinsPolyfill` config option. In `remix.config.js` you can now disable polyfills of Node.js built-in modules for non-Node.js server platforms, or opt into a subset of polyfills.

```js
// Disable all polyfills
exports.serverNodeBuiltinsPolyfill = { modules: {} };

// Enable specific polyfills
exports.serverNodeBuiltinsPolyfill = {
  modules: {
    crypto: true, // Provide a JSPM polyfill
    fs: 'empty', // Provide an empty polyfill
  },
};
```
