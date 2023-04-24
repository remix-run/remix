---
"@remix-run/dev": minor
"@remix-run/server-runtime": minor
---

Dev server improvements

- Push-based app server syncing that doesn't rely on polling
- App server as a managed subprocess

# Guide

## 1. Enable new dev server

Enable `unstable_dev` in `remix.config.js`:

```js
{
  future: {
    "unstable_dev": true
  }
}
```

## 2. Update `package.json` scripts

Specify the command to run your app server with the `-c`/`--command` flag:

For Remix app server:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development remix dev -c 'node_modules/.bin/remix-serve build'"
  }
}
```

For any other servers, specify the command you use to run your production server.

```json
{
  "scripts": {
    "dev": "NODE_ENV=development remix dev -c 'node ./server.js'"
  }
}
```

## 3. Call `ping` in your app server

For example, in an Express server:

```js
// server.mjs
import path from "node:path";

import express from "express";
import { createRequestHandler } from "@remix-run/express";
import { ping } from "@remix-run/dev";

let BUILD_DIR = path.join(process.cwd(), "build"); // path to Remix's server build directory (`build/` by default)

let app = express();

app.all(
  "*",
  createRequestHandler({
    build: require(BUILD_DIR),
    mode: process.env.NODE_ENV,
  })
);

app.listen(3000, () => {
  let build = require(BUILD_DIR);
  console.log('Ready: http://localhost:' + port);

  // in development, call `ping` _after_ your server is ready
  if (process.env.NODE_ENV === 'development') {
    ping(build);
  }
});
```

## 4. That's it!

You should now be able to run the Remix Dev server:

```sh
$ npm run dev
# Ready: http://localhost:3000
```

Make sure you navigate to your app server's URL in the browser, in this example `http://localhost:3000`.
Note: Any ports configured for the dev server are internal only (e.g. `--http-port` and `--websocket-port`)

# Configuration

Example:

```js
{
  future: {
    unstable_dev: {
      // Port internally used by the dev server to receive app server `ping`s
      httpPort: 3001, // by default, Remix chooses an open port in the range 3001-3099
      // Port internally used by the dev server to send live reload, HMR, and HDR updates to the browser
      websocketPort: 3002, // by default, Remix chooses an open port in the range 3001-3099
      // Whether the app server should be restarted when app is rebuilt
      // See `Advanced > restart` for more
      restart: false, // default: `true`
    }
  }
}
```

You can also configure via flags:

```sh
remix dev -c 'node ./server.mjs' --http-port=3001 --websocket-port=3002 --no-restart
```

## Advanced

### Dev server scheme/host/port

If you've customized the dev server's origin (e.g. for Docker or SSL support), you can use the `ping` options to specify the scheme/host/port for the dev server:

```js
ping(build, {
  scheme: "https", // defaults to http
  host: "mycustomhost", // defaults to localhost
  port: 3003 // defaults to REMIX_DEV_HTTP_PORT environment variable
});
```

### restart

If you want to manage app server updates yourself, you can use the `--no-restart` flag so that the Remix dev server doesn't restart the app server subprocess when a rebuild succeeds.

For example, if you rely on require cache purging to keep your app server running while server changes are pulled in, then you'll want to use `--no-restart`.

🚨 It is then your responsibility to call `ping` whenever server changes are incorporated in your app server. 🚨

So for require cache purging, you'd want to:
1. Purge the require cache
2. `require` your server build
3. Call `ping` within a `if (process.env.NODE_ENV === 'development')`

([Looking at you, Kent](https://github.com/kentcdodds/kentcdodds.com/blob/main/server/index.ts#L298) 😆)

---

The ultimate solution here would be to implement _server-side_ HMR (not to be confused with the more popular client-side HMR).
Then your app server could continuously update itself with new build with 0 downtime and without losing in-memory data that wasn't affected by the server changes.

That's left as an exercise to the reader.
