---
title: "@remix-run/dev"
---

This contains the Remix compiler and CLI. Make sure it is in your package.json `devDependencies` so it doesn't get deployed to your server.

<docs-info>We have recently removed the legacy Rollup based compiler and have fully made the switch to esbuild. This means the old compiler is deprecated, so please upgrade ASAP :) We hope you enjoy the 30-100x speed improvements to be had with the new toolchains.</docs-info>

## New Compiler

### `remix setup`

Remix is architected in a way that is not locked to a specific runtime, but this introduces a few challenges in getting your environment setup properly. To make life as easy as possible we have included the `remix setup` command that will prepare your `node_modules/remix` folder; simply include this command in your packages postinstall command:

```json
{
  "scripts": {
    "postinstall": "remix setup"
  }
}
```

### `remix build`

Builds your app for production with our new [esbuild](https://esbuild.github.io)-based compiler.

```sh
$ remix build
```

### `remix dev`

Watches your application files and builds your app for development when files change with our new esbuild-based compiler.

```sh
$ remix dev
```

## `remix run`

Same as `dev` but also boots the [Remix app server](../serve/) in development mode.

```sh
$ remix run
```
