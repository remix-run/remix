# `node-serve` CHANGELOG

This is the changelog for [`node-serve`](https://github.com/remix-run/remix/tree/main/packages/node-serve). It follows [semantic versioning](https://semver.org/).

## v0.2.0

### Minor Changes

- Add a `setup(app)` option to `serve()` so managed node-serve apps can register native uWebSockets.js WebSocket routes and connection filters before the Fetch fallback route starts listening.

  ```ts
  import { serve } from 'remix/node-serve'

  serve(handler, {
    setup(app) {
      app.ws('/ws/chat', {
        message(ws, message, isBinary) {
          ws.publish('chat', message, isBinary)
        },
      })

      app.filter((_res, count) => {
        console.log(`Active uWS connections: ${count}`)
      })
    },
  })
  ```

### Patch Changes

- Pass native `Request` objects to Fetch handlers instead of lazy request facades.

- Install `uWebSockets.js` as a required dependency so `remix/node-serve` works when package managers omit optional dependencies.

## v0.1.0

### Minor Changes

- Add `node-serve`, a high-performance Node.js server package for running Fetch API request handlers with the `remix/node-serve` export.

## Unreleased
