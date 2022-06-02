---
title: "@remix-run/dev (CLI)"
order: 1
---

# Remix CLI

The Remix CLI comes from the `@remix-run/dev` package. It also includes the compiler. Make sure it is in your package.json `devDependencies` so it doesn't get deployed to your server.

## Commands

### `remix build`

Builds your app for production. No need to add `NODE_ENV=production` to the command.

```sh
remix build
```

### `remix watch`

Watches your application files and builds your app for development when files change.

```sh
remix watch
```

### `remix dev`

Same as `watch` but also boots the [Remix app server](serve.md) in development mode if it's installed.

```sh
remix dev
```

_Note: The default port is `3000`, but can be changed by setting the `PORT` environment variable. If you are changing this to run multiple instances of Remix, you must also set unique [Dev websocket ports](https://remix.run/docs/en/v1/api/conventions#devserverport) via `remix.config.js` or setting `REMIX_DEV_SERVER_WS_PORT`._
