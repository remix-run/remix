---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
---

Reuse dev server port for WebSocket (Live Reload,HMR,HDR)

As a result the `webSocketPort`/`--websocket-port` option has been obsoleted.
Additionally, scheme/host/port options for the dev server have been renamed.

Available options are:

| Option     | flag               | config           | default                           |
| ---------- | ------------------ | ---------------- | --------------------------------- |
| Command    | `-c` / `--command` | `command`        | `remix-serve <server build path>` |
| Scheme     | `--scheme`         | `scheme`         | `http`                            |
| Host       | `--host`           | `host`           | `localhost`                       |
| Port       | `--port`           | `port`           | Dynamically chosen open port      |
| No restart | `--no-restart`     | `restart: false` | `restart: true`                   |

Note that scheme/host/port options are for the _dev server_, not your app server.
You probably don't need to use scheme/host/port option if you aren't configuring networking (e.g. for Docker or SSL).
