---
"@remix-run/dev": minor
"@remix-run/server-runtime": minor
---

The Remix dev server spins up your app server as a managed subprocess.
This keeps your development environment as close to production as possible.
It also means that the Remix dev server is compatible with _any_ app server.

By default, the dev server will use the Remix App Server, but you opt to use your own app server by specifying the command to run it via the `-c`/`--command` flag:

```sh
remix dev # uses `remix-serve <serve build path>` as the app server
remix dev -c "node ./server.js" # uses your custom app server at `./server.js`
```

The dev server will:

- force `NODE_ENV=development` and warn you if it was previously set to something else
- rebuild your app whenever your Remix app code changes
- restart your app server whenever rebuilds succeed
- handle live reload and HMR + Hot Data Revalidation

### App server coordination

In order to manage your app server, the dev server needs to be told what server build is currently being used by your app server.
This works by having the app server send a "I'm ready!" message with the Remix server build hash as the payload.

This is handled automatically in Remix App Server and is set up for you via calls to `broadcastDevReady` or `logDevReady` in the official Remix templates.

If you are not using Remix App Server and your server doesn't call `broadcastDevReady`, you'll need to call it in your app server _after_ it is up and running.
For example, in an Express server:

```js
// server.js
// <other imports>
import { broadcastDevReady } from "@remix-run/node";

// Path to Remix's server build directory ('build/' by default)
const BUILD_DIR = path.join(process.cwd(), "build");

// <code setting up your express server>

app.listen(3000, () => {
  const build = require(BUILD_DIR);
  console.log("Ready: http://localhost:" + port);

  // in development, call `broadcastDevReady` _after_ your server is up and running
  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(build);
  }
});
```

### Options

Options priority order is: 1. flags, 2. config, 3. defaults.

| Option         | flag               | config           | default                           |
| -------------- | ------------------ | ---------------- | --------------------------------- |
| Command        | `-c` / `--command` | `command`        | `remix-serve <server build path>` |
| HTTP(S) scheme | `--http-scheme`    | `httpScheme`     | `http`                            |
| HTTP(S) host   | `--http-host`      | `httpHost`       | `localhost`                       |
| HTTP(S) port   | `--http-port`      | `httpPort`       | Dynamically chosen open port      |
| Websocket port | `--websocket-port` | `websocketPort`  | Dynamically chosen open port      |
| No restart     | `--no-restart`     | `restart: false` | `restart: true`                   |

🚨 The `--http-*` flags are only used for internal dev server <-> app server communication.
Your app will run on your app server's normal URL.

To set `unstable_dev` configuration, replace `unstable_dev: true` with `unstable_dev: { <options> }`.
For example, to set the HTTP(S) port statically:

```js
// remix.config.js
module.exports = {
  future: {
    unstable_dev: {
      httpPort: 8001,
    },
  },
};
```

#### SSL and custom hosts

You should only need to use the `--http-*` flags and `--websocket-port` flag if you need fine-grain control of what scheme/host/port for the dev server.
If you are setting up SSL or Docker networking, these are the flags you'll want to use.

🚨 Remix **will not** set up SSL and custom host for you.
The `--http-scheme` and `--http-host` flag are for you to tell Remix how you've set things up.
It is your task to set up SSL certificates and host files if you want those features.

#### `--no-restart` and `require` cache purging

If you want to manage server changes yourself, you can use the `--no-restart` flag to tell the dev server to refrain from restarting your app server when builds succeed:

```sh
remix dev -c "node ./server.js" --no-restart
```

For example, you could purge the `require` cache of your app server to keep it running while picking up server changes.
If you do so, you should watch the server build path (`build/` by default) for changes and only purge the `require` cache when changes are detected.

🚨 If you use `--no-restart`, it is your responsibility to call `broadcastDevReady` when your app server has picked up server changes.
For example, with `chokidar`:

```js
// server.dev.js
const BUILD_PATH = path.resolve(__dirname, "build");

const watcher = chokidar.watch(BUILD_PATH);

watcher.on("change", () => {
  // 1. purge require cache
  purgeRequireCache();
  // 2. load updated server build
  const build = require(BUILD_PATH);
  // 3. tell dev server that this app server is now ready
  broadcastDevReady(build);
});
```
