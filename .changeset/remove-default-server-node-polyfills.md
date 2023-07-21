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

For reference, the complete set of default polyfills from Remix v1 can be manually specified as follows:

```js
module.exports = {
  serverNodeBuiltinsPolyfill: {
    modules: {
      _stream_duplex: true,
      _stream_passthrough: true,
      _stream_readable: true,
      _stream_transform: true,
      _stream_writable: true,
      assert: true,
      "assert/strict": true,
      buffer: true,
      console: true,
      constants: true,
      crypto: "empty",
      diagnostics_channel: true,
      domain: true,
      events: true,
      fs: "empty",
      "fs/promises": "empty",
      http: true,
      https: true,
      module: true,
      os: true,
      path: true,
      "path/posix": true,
      "path/win32": true,
      perf_hooks: true,
      process: true,
      punycode: true,
      querystring: true,
      stream: true,
      "stream/promises": true,
      "stream/web": true,
      string_decoder: true,
      sys: true,
      timers: true,
      "timers/promises": true,
      tty: true,
      url: true,
      util: true,
      "util/types": true,
      vm: true,
      wasi: true,
      worker_threads: true,
      zlib: true,
    },
  },
};
```
