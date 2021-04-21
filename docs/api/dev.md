---
title: "@remix-run/dev"
---

This contains the Remix compiler and CLI. Make sure it is in your package.json `devDependencies` so it doesn't get deployed to your server.

<docs-info>We currently have two compilers, one that uses Rollup and a new one that uses esbuild. We are seeing 30-100x speed improvements with the new esbuild compiler. We encourage you to use it and report any issues you have so we can get it stable ASAP.</docs-info>

## `remix build2`

Builds your app for production with our new [esbuild](https://esbuild.github.io)-based compiler. If you're updating from the old compiler please see the [v0.15 release notes](../../releases/v0.15.0/).

```sh
$ remix build2
```

## `remix run2`

Watches your application files and builds your app for development when files change with our new esbuild-based compiler.

```sh
$ remix run2
```

## `remix build`

Same as `remix build2`, but with the old compiler. There are a couple differences between them regarding asset imports. With `remix build` you need to use `url:../something.css` instead of just `../something.css`.

```sh
$ remix build
```

## `remix run`

Same as `remix run2`, but with the old compiler.

```sh
$ remix build
```
