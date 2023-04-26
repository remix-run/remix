---
"@remix-run/dev": minor
"@remix-run/server-runtime": minor
---

Dev server improvements

- Push-based app server syncing that doesn't rely on polling
- App server as a managed subprocess
- Gracefully handle new files and routes without crashing
- Statically serve static assets to avoid fetch errors during app server reboots

# Guide

Enable `unstable_dev` in `remix.config.js`:

```js
{
  future: {
    "unstable_dev": true
  }
}
```

## Remix App Server

Update `package.json` scripts

```json
{
  "scripts": {
    "dev": "remix dev"
  }
}
```

That's it!

```sh
npm run dev
```

## Other app servers

Update `package.json` scripts, specifying the command to run you app server with the `-c`/`--command` flag:

```json
{
  "scripts": {
    "dev": "remix dev -c 'node ./server.js'"
  }
}
```

Then, call `broadcastDevReady` in your server when its up and running.

For example, an Express server would call `broadcastDevReady` at the end of `listen`:

```js
// <other imports>
import { broadcastDevReady } from "@remix-run/node";

// Path to Remix's server build directory ('build/' by default)
let BUILD_DIR = path.join(process.cwd(), "build");

// <code setting up your express server>

app.listen(3000, () => {
  let build = require(BUILD_DIR);
  console.log("Ready: http://localhost:" + port);

  // in development, call `broadcastDevReady` _after_ your server is up and running
  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(build);
  }
});
```

That's it!

```sh
npm run dev
```

# Configuration

Most users won't need to configure the dev server, but you might need to if:

- You are setting up custom origins for SSL support or for Docker networking
- You want to handle server updates yourself (e.g. via require cache purging)

```js
{
  future: {
    unstable_dev: {
      // Command to run your app server
      command: "wrangler", // default: `remix-serve ./build`
      // HTTP(S) scheme used when sending `broadcastDevReady` messages to the dev server
      httpScheme: "https", // default: `"http"`
      // HTTP(S) host used when sending `broadcastDevReady` messages to the dev server
      httpHost: "mycustomhost", // default: `"localhost"`
      // HTTP(S) port internally used by the dev server to statically serve built assets and to receive app server `broadcastDevReady` messages
      httpPort: 8001, // default: Remix chooses an open port in the range 3001-3099
      // Websocket port internally used by the dev server for sending updates to the browser (Live reload, HMR, HDR)
      websocketPort: 8002, // default: Remix chooses an open port in the range 3001-3099
      // Whether the app server should be restarted when app is rebuilt
      // See `Advanced > restart` for more
      restart: false, // default: `true`
    }
  }
}
```

You can also configure via flags. For example:

```sh
remix dev -c 'nodemon ./server.mjs' --http-port=3001 --websocket-port=3002 --no-restart
```

See `remix dev --help` for more details.

### restart

If you want to manage app server updates yourself, you can use the `--no-restart` flag so that the Remix dev server doesn't restart the app server subprocess when a rebuild succeeds.

For example, if you rely on require cache purging to keep your app server running while server changes are pulled in, then you'll want to use `--no-restart`.

🚨 It is then your responsibility to call `broadcastDevReady` whenever server changes are incorporated in your app server. 🚨

So for require cache purging, you'd want to:

1. Purge the require cache
2. `require` your server build
3. Call `broadcastDevReady` within a `if (process.env.NODE_ENV === 'development')`

([Looking at you, Kent](https://github.com/kentcdodds/kentcdodds.com/blob/main/server/index.ts#L298) 😆)

---

The ultimate solution for `--no-restart` would be for you to implement _server-side_ HMR for your app server.
Note: server-side HMR is not to be confused with the client-side HMR provided by Remix.
Then your app server could continuously update itself with new build with 0 downtime and without losing in-memory data that wasn't affected by the server changes.

This is left as an exercise to the reader.
