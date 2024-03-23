---
title: vite.config.ts
---

# vite.config.ts

<docs-warning>If your project is still using the [Classic Remix Compiler][classic-remix-compiler], you should refer to the [remix.config.js documentation][remix-config] instead.</docs-warning>

Remix uses [Vite] to compile your application. You'll need to provide a Vite config file with the Remix Vite plugin. Here's the minimum configuration you'll need:

```ts filename=vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix()],
});
```

<docs-info>Vite supports using a `.js` file for your config, but we recommend using TypeScript to help ensure your configuration is valid.</docs-info>

## Remix Vite Plugin Config

```js filename=vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      basename: "/",
      buildDirectory: "build",
      future: {
        /* any enabled future flags */
      },
      ignoredRouteFiles: ["**/*.css"],
      routes(defineRoutes) {
        return defineRoutes((route) => {
          route("/somewhere/cool/*", "catchall.tsx");
        });
      },
      serverBuildFile: "index.js",
    }),
  ],
});
```

#### appDirectory

The path to the `app` directory, relative to the project root. Defaults to
`"app"`.

#### future

The `future` config lets you opt-into future breaking changes via [Future Flags][future-flags]. The following future flags currently exist in Remix v2 and will become the default behavior in Remix v3:

- **`v3_fetcherPersist`**: Change fetcher persistence/cleanup behavior in 2 ways ([RFC][fetcherpersist-rfc]):
  - Fetchers are no longer removed on unmount, and remain exposed via [`useFetchers`][use-fetchers] until they return to an `idle` state
  - Fetchers that complete while still mounted no longer persist in [`useFetchers`][use-fetchers] since you can access those fetchers via [`useFetcher`][use-fetcher]
- **`v3_relativeSplatPath`**: Fixes buggy relative path resolution in splat routes. Please see the [React Router docs][relativesplatpath] for more information.
- **`v3_throwAbortReason`**: When a server-side request is aborted, Remix will throw the `request.signal.reason` instead of an error such as `new Error("query() call aborted...")`

#### ignoredRouteFiles

This is an array of globs (via [minimatch][minimatch]) that Remix will match to
files while reading your `app/routes` directory. If a file matches, it will be
ignored rather than treated like a route module. This is useful for ignoring
CSS/test files you wish to colocate.

#### routes

A function for defining custom routes, in addition to those already defined
using the filesystem convention in `app/routes`. Both sets of routes will be merged.

```ts filename=vite.config.ts
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    remix({
      routes: async (defineRoutes) => {
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
      },
    }),
  ],
});
```

#### serverModuleFormat

The output format of the server build, which can either be `"cjs"` or `"esm"`.
Defaults to `"esm"`.

#### buildDirectory

The path to the build directory, relative to the project root. Defaults to
`"build"`.

#### basename

An optional basename for your route paths, passed through to the [React Router "basename" option][rr-basename]. Please note that this is different from your _asset_ paths. You can can configure the [base public path][vite-public-base-path] for your assets via the [Vite "base" option][vite-base].

#### buildEnd

A function that is called after the full Remix build is complete.

#### manifest

Whether to write a `.remix/manifest.json` file to the build directory. Defaults
to `false`.

#### presets

An array of [presets] to ease integration with other tools and hosting providers.

#### serverBuildFile

The name of the server file generated in the server build directory. Defaults to `"index.js"`.

#### serverBundles

A function for assigning addressable routes to [server bundles][server-bundles].

You may also want to enable the `manifest` option since, when server bundles are enabled, it contains mappings between routes and server bundles.

[classic-remix-compiler]: ../future/vite#classic-remix-compiler-vs-remix-vite
[remix-config]: ./remix-config
[vite]: https://vitejs.dev
[future-flags]: ../start/future-flags
[fetcherpersist-rfc]: https://github.com/remix-run/remix/discussions/7698
[use-fetchers]: ../hooks/use-fetchers
[use-fetcher]: ../hooks/use-fetcher
[relativesplatpath]: https://reactrouter.com/en/main/hooks/use-resolved-path#splat-paths
[minimatch]: https://npm.im/minimatch
[presets]: ../future/presets
[server-bundles]: ../future/server-bundles
[rr-basename]: https://reactrouter.com/routers/create-browser-router#basename
[vite-public-base-path]: https://vitejs.dev/config/shared-options.html#base
[vite-base]: https://vitejs.dev/config/shared-options.html#base
