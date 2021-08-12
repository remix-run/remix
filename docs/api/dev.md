---
title: "@remix-run/dev"
---

This contains the Remix compiler and CLI. Make sure it is in your package.json `devDependencies` so it doesn't get deployed to your server.

<docs-info>We currently have two compilers, one that uses Rollup and a new one that uses esbuild. We are seeing 30-100x speed improvements with the new esbuild compiler. We encourage you to use it and report any issues you have so we can get it stable ASAP.</docs-info>

## New Compiler

### `remix build2`

Builds your app for production with our new [esbuild](https://esbuild.github.io)-based compiler. If you're updating from the old compiler please see the [v0.15 release notes](../../releases/v0.15.0/).

```sh
$ remix build2
```

### `remix run2`

Watches your application files and builds your app for development when files change with our new esbuild-based compiler.

```sh
$ remix run2
```

## `remix run3`

Same as `run2` but also boots the [Remix app server](../serve/) in development mode.

```sh
$ remix run2
```

## Old Compiler

### `remix build`

Same as `remix build2`, but with the old compiler. There are a couple differences between them regarding asset imports. With `remix build` you need to use `url:../something.css` instead of just `../something.css`.

```sh
$ remix build
```

### `remix run`

Same as `remix run2`, but with the old compiler.

```sh
$ remix build
```

## Future Changes

You'll note the names of these commands right now are a little nutty. When we shipped the new compiler the "run2" and "build2" commands showed up. Then we shipped the built-in app server and "run3" showed up!

In the next release there will only be three commands:

- `remix run` - today's `run3` (remix app server + dev asset server)
- `remix dev` - today's `run2` (dev asset server to be used alongside your own own server)
- `remix build` - today's `build2`

This means the old compiler will also be deprecated, so please upgrade ASAP :)
