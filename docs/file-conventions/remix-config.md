---
title: remix.config.js
---

# remix.config.js

This file has a few build and development configuration options, but does not actually run on your server.

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  ignoredRouteFiles: ["**/.*"],
  publicPath: "/build/",
  routes(defineRoutes) {
    return defineRoutes((route) => {
      route("/somewhere/cool/*", "catchall.tsx");
    });
  },
  serverBuildPath: "build/index.js",
};
```

## appDirectory

The path to the `app` directory, relative to remix.config.js. Defaults to
`"app"`.

```js filename=remix.config.js
// default
exports.appDirectory = "./app";

// custom
exports.appDirectory = "./elsewhere";
```

## assetsBuildDirectory

The path to the browser build, relative to remix.config.js. Defaults to
"public/build". Should be deployed to static hosting.

## cacheDirectory

The path to a directory Remix can use for caching things in development,
relative to `remix.config.js`. Defaults to `".cache"`.

## devServerBroadcastDelay

<docs-warning>This option is deprecated and will likely be removed in a future
stable release. Enable `v2_dev` to eliminate the race conditions that necessitated
this option.</docs-warning>

The delay, in milliseconds, before the dev server broadcasts a reload event.
There is no delay by default.

## devServerPort

<docs-warning>This option is deprecated and will likely be removed in a future
stable release. Enable `v2_dev` and use [`--port` / `v2_dev.port` option][port]
instead.</docs-warning>

The port number to use for the dev websocket server. Defaults to 8002.

## ignoredRouteFiles

This is an array of globs (via [minimatch][minimatch]) that Remix will match to
files while reading your `app/routes` directory. If a file matches, it will be
ignored rather than treated like a route module. This is useful for ignoring
dotfiles (like `.DS_Store` files) or CSS/test files you wish to colocate.

## publicPath

The URL prefix of the browser build with a trailing slash. Defaults to
`"/build/"`. This is the path the browser will use to find assets.

## postcss

Whether to process CSS using [PostCSS][postcss] if `postcss.config.js` is present. Defaults to `false`.

## routes

A function for defining custom routes, in addition to those already defined
using the filesystem convention in `app/routes`. Both sets of routes will be merged.

```js filename=remix.config.js
exports.routes = async (defineRoutes) => {
  // If you need to do async work, do it before calling `defineRoutes`, we use
  // the call stack of `route` inside to set nesting.

  return defineRoutes((route) => {
    // A common use for this is catchall routes.
    // - The first argument is the React Router path to match against
    // - The second is the relative filename of the route handler
    route("/some/path/*", "catchall.tsx");

    // if you want to nest routes, use the optional callback argument
    route("some/:path", "some/route/file.js", () => {
      // - path is relative to parent path
      // - filenames are still relative to the app directory
      route("relative/path", "some/other/file");
    });
  });
};
```

## server

A server entrypoint, relative to the root directory that becomes your server's
main module. If specified, Remix will compile this file along with your
application into a single file to be deployed to your server. This file can use
either a `.js` or `.ts` file extension.

## serverBuildDirectory

<docs-warning>This option is deprecated and will likely be removed in a future
stable release. Use [`serverBuildPath`][server-build-path]
instead.</docs-warning>

The path to the server build, relative to `remix.config.js`. Defaults to
"build". This needs to be deployed to your server.

## serverBuildPath

The path to the server build file, relative to `remix.config.js`. This file
should end in a `.js` extension and should be deployed to your server. Defaults
to `"build/index.js"`.

## serverBuildTarget

<docs-warning>This option is deprecated and will be removed in the next major version release. Use a combination of [`publicPath`][public-path],
[`serverBuildPath`][server-build-path], [`serverConditions`][server-conditions],
[`serverDependenciesToBundle`][server-dependencies-to-bundle]
[`serverMainFields`][server-main-fields], [`serverMinify`][server-minify],
[`serverModuleFormat`][server-module-format] and/or
[`serverPlatform`][server-platform] instead.</docs-warning>

The target of the server build. Defaults to `"node-cjs"`.

The `serverBuildTarget` can be one of the following:

- [`"arc"`][arc]
- [`"cloudflare-pages"`][cloudflare-pages]
- [`"cloudflare-workers"`][cloudflare-workers]
- [`"deno"`][deno]
- [`"netlify"`][netlify]
- [`"node-cjs"`][node-cjs]
- [`"vercel"`][vercel]

## serverConditions

The order of conditions to use when resolving server dependencies' `exports`
field in `package.json`.

## serverDependenciesToBundle

A list of regex patterns that determines if a module is transpiled and included
in the server bundle. This can be useful when consuming ESM only packages in a
CJS build, or when consuming packages with [CSS side effect
imports][css-side-effect-imports].

For example, the `unified` ecosystem is all ESM-only. Let's also say we're using
a `@sindresorhus/slugify` which is ESM-only as well. Here's how you would be
able to consume those packages in a CJS app without having to use dynamic
imports:

```js filename=remix.config.js lines=[8-13]
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  publicPath: "/build/",
  serverBuildDirectory: "build",
  ignoredRouteFiles: ["**/.*"],
  serverDependenciesToBundle: [
    /^rehype.*/,
    /^remark.*/,
    /^unified.*/,
    "@sindresorhus/slugify",
  ],
};
```

If you want to bundle all server dependencies, you can set
`serverDependenciesToBundle` to `"all"`.

## serverMainFields

The order of main fields to use when resolving server dependencies. Defaults to
`["main", "module"]` when `serverModuleFormat` is set to `"cjs"`. Defaults to
`["module", "main"]` when `serverModuleFormat` is set to `"esm"`.

## serverMinify

Whether to minify the server build in production or not. Defaults to `false`.

## serverModuleFormat

The output format of the server build, which can either be `"cjs"` or `"esm"`.
Defaults to `"cjs"`.

## serverNodeBuiltinsPolyfill

The Node.js polyfills to include in the server build when targeting non-Node.js server platforms. Polyfills are provided by [JSPM][jspm] and configured via [esbuild-plugins-node-modules-polyfill].

```js filename=remix.config.js
exports.serverNodeBuiltinsPolyfill = {
  modules: {
    path: true, // Provide a JSPM polyfill
    fs: "empty", // Provide an empty polyfill
  },
};
```

If left unset, this config defaults to the following set of polyfills for non-Node.js server platforms:

```js filename=remix.config.js
exports.serverNodeBuiltinsPolyfill = {
  modules: {
    _stream_duplex: true,
    _stream_passthrough: true,
    _stream_readable: true,
    _stream_transform: true,
    _stream_writable: true,
    assert: true,
    "assert/strict": true,
    buffer: true,
    console: true,
    constants: true,
    crypto: "empty",
    diagnostics_channel: true,
    domain: true,
    events: true,
    fs: "empty",
    "fs/promises": "empty",
    http: true,
    https: true,
    module: true,
    os: true,
    path: true,
    "path/posix": true,
    "path/win32": true,
    perf_hooks: true,
    process: true,
    punycode: true,
    querystring: true,
    stream: true,
    "stream/promises": true,
    "stream/web": true,
    string_decoder: true,
    sys: true,
    timers: true,
    "timers/promises": true,
    tty: true,
    url: true,
    util: true,
    "util/types": true,
    vm: true,
    wasi: true,
    worker_threads: true,
    zlib: true,
  },
};
```

<docs-warning>
This default behavior is changing in Remix v2 and will no longer polyfill any Node built-in modules on non-Node.js platforms by default.  If your app requires polyfills, you will need to manually specify them via this setting. It's recommend to start manually specifying required polyfills for your app in v1 to ease your eventual migration to v2.
</docs-warning>

## serverPlatform

The platform the server build is targeting, which can either be `"neutral"` or
`"node"`. Defaults to `"node"`.

## tailwind

Whether to support [Tailwind functions and directives][tailwind-functions-and-directives] in CSS files if `tailwindcss` is installed. Defaults to `false`.

## watchPaths

An array, string, or async function that defines custom directories, relative to the project root, to watch while running [remix dev][remix-dev]. These directories are in addition to [`appDirectory`][app-directory].

```js filename=remix.config.js
exports.watchPaths = async () => {
  return ["./some/path/*"];
};

// also valid
exports.watchPaths = ["./some/path/*"];
```

## File Name Conventions

There are a few conventions that Remix uses you should be aware of.

<docs-info>[Dilum Sanjaya][dilum-sanjaya] made [an awesome visualization][an-awesome-visualization] of how routes in the file system map to the URL in your app that might help you understand these conventions.</docs-info>

[minimatch]: https://www.npmjs.com/package/minimatch
[public-path]: #publicpath
[server-build-path]: #serverbuildpath
[server-conditions]: #serverconditions
[server-dependencies-to-bundle]: #serverdependenciestobundle
[server-main-fields]: #servermainfields
[server-minify]: #serverminify
[server-module-format]: #servermoduleformat
[server-platform]: #serverplatform
[arc]: https://arc.codes
[cloudflare-pages]: https://pages.cloudflare.com
[cloudflare-workers]: https://workers.cloudflare.com
[deno]: https://deno.land
[netlify]: https://www.netlify.com
[node-cjs]: https://nodejs.org/en
[vercel]: https://vercel.com
[dilum-sanjaya]: https://twitter.com/DilumSanjaya
[an-awesome-visualization]: https://remix-routing-demo.netlify.app
[remix-dev]: ../other-api/dev#remix-dev
[app-directory]: #appDirectory
[css-side-effect-imports]: ../guides/styling#css-side-effect-imports
[postcss]: https://postcss.org
[tailwind-functions-and-directives]: https://tailwindcss.com/docs/functions-and-directives
[jspm]: https://github.com/jspm/jspm-core
[esbuild-plugins-node-modules-polyfill]: https://www.npmjs.com/package/esbuild-plugins-node-modules-polyfill
[port]: ../other-api/dev-v2#options-1
