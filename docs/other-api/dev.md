---
title: "@remix-run/dev (CLI)"
order: 1
---

# Remix CLI

The Remix CLI comes from the `@remix-run/dev` package. It also includes the compiler. Make sure it is in your package.json `devDependencies` so it doesn't get deployed to your server.

## Commands

### `remix setup`

Remix is architected in a way that is not locked to a specific runtime, but this introduces a few challenges in getting your environment setup properly. To make life as easy as possible, we have included the `remix setup` command that will prepare your `node_modules/remix` folder; simply include this command in your packages postinstall command (the starter templates already do this):

```json
{
  "scripts": {
    "postinstall": "remix setup"
  }
}
```

Now, no matter which platform you're deploying to, you can import everything you need from `"remix"`.

```js
// whether you're on cloudflare workers, node.js, or something
// else everything you need will come from this package.
import {} from "remix";
```

### `remix build`

Builds your app for production. No need to add `NODE_ENV=production` to the command.

```sh
$ remix build
```

### `remix watch`

Watches your application files and builds your app for development when files change.

```sh
$ remix watch
```

### `remix dev`

Same as `watch` but also boots the [Remix app server](serve.md) in development mode if it's installed.

```sh
$ remix dev
```
