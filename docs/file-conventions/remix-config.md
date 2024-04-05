---
title: remix.config.js
hidden: true
---

# remix.config.js

<docs-warning>`remix.config.js` is only relevant when using the [Classic Remix Compiler][classic-remix-compiler]. When using [Remix Vite][remix-vite], this file should not be present in your project. Instead, Remix configuration should be provided to the Remix plugin in your [Vite config][vite-config].</docs-warning>

This file has a few build and development configuration options, but does not actually run on your server.

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  future: {
    /* any enabled future flags */
  },
  ignoredRouteFiles: ["**/*.css"],
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

## browserNodeBuiltinsPolyfill

The Node.js polyfills to include in the browser build. Polyfills are provided by [JSPM][jspm] and configured via [esbuild-plugins-node-modules-polyfill].

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  browserNodeBuiltinsPolyfill: {
    modules: {
      buffer: true, // Provide a JSPM polyfill
      fs: "empty", // Provide an empty polyfill
    },
    globals: {
      Buffer: true,
    },
  },
};
```

When using this option and targeting non-Node.js server platforms, you may also want to configure Node.js polyfills for the server via [`serverNodeBuiltinsPolyfill`][server-node-builtins-polyfill].

## cacheDirectory

The path to a directory Remix can use for caching things in development,
relative to `remix.config.js`. Defaults to `".cache"`.

## future

The `future` config lets you opt-into future breaking changes via [Future Flags][future-flags]. The following future flags currently exist in Remix v2 and will become the default behavior in Remix v3:

- **`v3_fetcherPersist`**: Change fetcher persistence/cleanup behavior in 2 ways ([RFC][fetcherpersist-rfc]):
  - Fetchers are no longer removed on unmount, and remain exposed via [`useFetchers`][use-fetchers] until they return to an `idle` state
  - Fetchers that complete while still mounted no longer persist in [`useFetchers`][use-fetchers] since you can access those fetchers via [`useFetcher`][use-fetcher]
- **`v3_relativeSplatPath`**: Fixes buggy relative path resolution in splat routes. Please see the [React Router docs][relativesplatpath] for more information.
- **`v3_throwAbortReason`**: When a server-side request is aborted, Remix will throw the `request.signal.reason` instead of an error such as `new Error("query() call aborted...")`

## ignoredRouteFiles

This is an array of globs (via [minimatch][minimatch]) that Remix will match to
files while reading your `app/routes` directory. If a file matches, it will be
ignored rather than treated like a route module. This is useful for ignoring
CSS/test files you wish to colocate.

## publicPath

The URL prefix of the browser build with a trailing slash. Defaults to
`"/build/"`. This is the path the browser will use to find assets.

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  publicPath: "/assets/",
};
```

If you wish to serve static assets from a separate domain you may also specify an absolute path:

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  publicPath: "https://static.example.com/assets/",
};
```

## postcss

Whether to process CSS using [PostCSS][postcss] if a PostCSS config file is present. Defaults to `true`.

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  postcss: false,
};
```

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

## serverBuildPath

The path to the server build file, relative to `remix.config.js`. This file
should end in a `.js` extension and should be deployed to your server. Defaults
to `"build/index.js"`.

## serverConditions

The order of conditions to use when resolving server dependencies' `exports`
field in `package.json`.

## serverDependenciesToBundle

A list of regex patterns that determines if a module is transpiled and included
in the server bundle. This can be useful when consuming ESM only packages in a
CJS build, or when consuming packages with [CSS side effect
imports][css_side_effect_imports].

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
  serverBuildPath: "build/index.js",
  ignoredRouteFiles: ["**/*.css"],
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
Defaults to `"esm"`.

## serverNodeBuiltinsPolyfill

The Node.js polyfills to include in the server build when targeting non-Node.js server platforms. Polyfills are provided by [JSPM][jspm] and configured via [esbuild-plugins-node-modules-polyfill].

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  serverNodeBuiltinsPolyfill: {
    modules: {
      buffer: true, // Provide a JSPM polyfill
      fs: "empty", // Provide an empty polyfill
    },
    globals: {
      Buffer: true,
    },
  },
};
```

When using this option, you may also want to configure Node.js polyfills for the browser via [`browserNodeBuiltinsPolyfill`][browser-node-builtins-polyfill].

## serverPlatform

The platform the server build is targeting, which can either be `"neutral"` or
`"node"`. Defaults to `"node"`.

## tailwind

Whether to support [Tailwind functions and directives][tailwind_functions_and_directives] in CSS files if `tailwindcss` is installed. Defaults to `true`.

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  tailwind: false,
};
```

## watchPaths

An array, string, or async function that defines custom directories, relative to the project root, to watch while running [remix dev][remix_dev]. These directories are in addition to [`appDirectory`][app_directory].

```js filename=remix.config.js
exports.watchPaths = async () => {
  return ["./some/path/*"];
};

// also valid
exports.watchPaths = ["./some/path/*"];
```

## File Name Conventions

There are a few conventions that Remix uses you should be aware of.

<docs-info>[Dilum Sanjaya][dilum_sanjaya] made [an awesome visualization][an_awesome_visualization] of how routes in the file system map to the URL in your app that might help you understand these conventions.</docs-info>

[minimatch]: https://npm.im/minimatch
[dilum_sanjaya]: https://twitter.com/DilumSanjaya
[an_awesome_visualization]: https://interactive-remix-routing-v2.netlify.app
[remix_dev]: ../other-api/dev#remix-dev
[app_directory]: #appdirectory
[css_side_effect_imports]: ../styling/css-imports
[postcss]: https://postcss.org
[tailwind_functions_and_directives]: https://tailwindcss.com/docs/functions-and-directives
[jspm]: https://github.com/jspm/jspm-core
[esbuild-plugins-node-modules-polyfill]: https://npm.im/esbuild-plugins-node-modules-polyfill
[browser-node-builtins-polyfill]: #browsernodebuiltinspolyfill
[server-node-builtins-polyfill]: #servernodebuiltinspolyfill
[future-flags]: ../start/future-flags
[fetcherpersist-rfc]: https://github.com/remix-run/remix/discussions/7698
[use-fetchers]: ../hooks/use-fetchers
[use-fetcher]: ../hooks/use-fetcher
[relativesplatpath]: https://reactrouter.com/en/main/hooks/use-resolved-path#splat-paths
[classic-remix-compiler]: ../future/vite#classic-remix-compiler-vs-remix-vite
[remix-vite]: ../future/vite
[vite-config]: ./vite-config
