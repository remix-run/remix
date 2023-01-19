---
"remix": minor
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/serve": minor
"@remix-run/server-runtime": minor
---

# The new dev server

The new dev flow is to spin up the dev server _alongside_ your normal Remix app server:

```sh
# spin up the new dev server
remix dev

# spin up your app server in a separate tab or via `concurrently`
nodemon ./server.js
```

The dev server will build your app in dev mode and then rebuild whenever any app files change.
It will also wait for your app server to be "ready" (more on this later) before triggering a live reload in your browser.

## Benefits

- Navigations no longer wipe in-memory references (e.g. database connections, in-memory caches, etc...). That means no need to use `global` trick anymore.
- Supports _any_ app server, not just the Remix App Server.
- Automatically wires up the live reload port for you (no need for you to mess with env vars for that anymore)

## App server picks up changes

Use `nodemon` (or similar) so that your app server restarts and picks up changes after a rebuild finishes.

For example, you can use `wrangler --watch` for Cloudflare.

Alternatively, you can roll your own with `chokidar` (or similar) if you want to still use the `global` trick to persist in-memory stuff across rebuilds.

## Configure

To enable the new dev server with all defaults, set the `unstable_dev` future flag to `true`:

```js
// remix.config.js

module.exports = {
  future: {
    unstable_dev: true,
  },
};
```

You can also set specific options:

```js
// remix.config.js

module.exports = {
  future: {
    unstable_dev: {
      // Port to use for the dev server (i.e. the live reload websocket)
      // Can be overridden by a CLI flag: `remix dev --port 3011`
      // default: finds an empty port and uses that
      port: 3010,

      // Port for your running Remix app server
      // Can be overridden by a CLI flag: `remix dev --app-server-port 3021`
      // default: `3000`
      appServerPort: 3020,

      // Path to the Remix request handler in your app server
      // Most app server will route all requests to the Remix request handler and will not need to set this option.
      // If your app server _does_ route only certain request paths to the Remix request handler, then you'll need to set this.
      // default: `""`
      remixRequestHandlerPath: "/products",

      // Milliseconds between "readiness" pings to your app server
      // When a Remix rebuild finishes, the dev server will ping a special endpoint (`__REMIX_ASSETS_MANIFEST`)
      // to check if your app server is serving up-to-date routes and assets.
      // You can set this option to tune how frequently the dev server polls your app server.
      // default: `50`
      rebuildPollIntervalMs: 25,
    },
  },
};
```
