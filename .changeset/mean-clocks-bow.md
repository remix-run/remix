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

- Dev server port
  - flag: `--port`
  - future config: `unstable_dev.port`
  - default: finds an empty port to use
- App server port
  - flag: `--app-server-port`
  - future config: `unstable_dev.appServerPort`
  - default: `3000`
- Remix request handler path
  - Most Remix apps shouldn't need this, but if you wire up the Remix request handler at a specific URL path set this to that path so that the dev server can reliably check your app server for "readiness"
  - future flag: `unstable_dev.remixRequestHandlerPath`
  - default: `''`
- Rebuild poll interval (milliseconds)
  - future config: `unstable_dev.rebuildPollIntervalMs`
  - default: 50ms
