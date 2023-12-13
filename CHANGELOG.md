<!-- markdownlint-disable no-duplicate-header no-emphasis-as-heading no-inline-html -->

# Remix Releases

This page lists all releases/release notes for Remix back to `v2.0.0`. For releases prior to v2, please refer to the [Github Releases Page](https://github.com/remix-run/remix/releases).

We manage release notes in this file instead of the paginated Github Releases Page for 2 reasons:

- Pagination in the Github UI means that you cannot easily search release notes for a large span of releases at once
- The paginated Github interface also cuts off longer releases notes without indication in list view, and you need to click into the detail view to see the full set of release notes

<details>
  <summary>Table of Contents</summary>

- [Remix Releases](#remix-releases)
  - [v2.4.0](#v240)
    - [What's Changed](#whats-changed)
      - [Client Data](#client-data)
      - [`future.v3_relativeSplatPath`](#futurev3_relativesplatpath)
      - [Vite Updates (Unstable)](#vite-updates-unstable)
    - [Minor Changes](#minor-changes)
    - [Patch Changes](#patch-changes)
    - [Updated Dependencies](#updated-dependencies)
    - [Changes by Package](#changes-by-package)
  - [v2.3.1](#v231)
    - [Patch Changes](#patch-changes-1)
    - [Updated Dependencies](#updated-dependencies-1)
    - [Changes by Package](#changes-by-package-1)
  - [v2.3.0](#v230)
    - [What's Changed](#whats-changed-1)
      - [Stabilized `useBlocker`](#stabilized-useblocker)
      - [`unstable_flushSync` API](#unstable_flushsync-api)
    - [Minor Changes](#minor-changes-1)
    - [Patch Changes](#patch-changes-2)
    - [Updated Dependencies](#updated-dependencies-2)
    - [Changes by Package](#changes-by-package-2)
  - [v2.2.0](#v220)
    - [What's Changed](#whats-changed-2)
      - [Vite!](#vite)
      - [New Fetcher APIs](#new-fetcher-apis)
      - [Persistence Future Flag](#persistence-future-flag)
    - [Minor Changes](#minor-changes-2)
    - [Patch Changes](#patch-changes-3)
    - [Updated Dependencies](#updated-dependencies-3)
    - [Changes by Package](#changes-by-package-3)
  - [v2.1.0](#v210)
    - [What's Changed](#whats-changed-3)
      - [View Transitions](#view-transitions)
      - [Stable `createRemixStub`](#stable-createremixstub)
    - [Minor Changes](#minor-changes-3)
    - [Patch Changes](#patch-changes-4)
    - [Updated Dependencies](#updated-dependencies-4)
    - [Changes by Package](#changes-by-package-4)
  - [v2.0.1](#v201)
    - [Patch Changes](#patch-changes-5)
    - [Changes by Package 🔗](#changes-by-package-)
  - [v2.0.0](#v200)
    - [Breaking Changes](#breaking-changes)
      - [Upgraded Dependency Requirements](#upgraded-dependency-requirements)
      - [Removed Future Flags](#removed-future-flags)
      - [Breaking Changes/API Removals](#breaking-changesapi-removals)
        - [With deprecation warnings](#with-deprecation-warnings)
        - [Without deprecation warnings](#without-deprecation-warnings)
        - [Breaking Type Changes](#breaking-type-changes)
    - [New Features](#new-features)
    - [Other Notable Changes](#other-notable-changes)
    - [Updated Dependencies](#updated-dependencies-5)
    - [Changes by Package](#changes-by-package-5)

</details>

<!--
To add a new release, copy from this template:

## v2.X.Y

### What's Changed

#### Big New Feature 1

#### Big New Feature 2

### Minor Changes

### Patch Changes

### Updated Dependencies

- [`react-router-dom@6.X.Y`](https://github.com/remix-run/react-router/releases/tag/react-router%406.X.Y)
- [`@remix-run/router@1.X.Y`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#1XY)

### Changes by Package

- [`create-remix`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/create-remix/CHANGELOG.md#2XY)
- [`@remix-run/architect`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-architect/CHANGELOG.md#2XY)
- [`@remix-run/cloudflare`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-cloudflare/CHANGELOG.md#2XY)
- [`@remix-run/cloudflare-pages`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-cloudflare-pages/CHANGELOG.md#2XY)
- [`@remix-run/cloudflare-workers`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-cloudflare-workers/CHANGELOG.md#2XY)
- [`@remix-run/css-bundle`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-css-bundle/CHANGELOG.md#2XY)
- [`@remix-run/deno`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-deno/CHANGELOG.md#2XY)
- [`@remix-run/dev`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-dev/CHANGELOG.md#2XY)
- [`@remix-run/eslint-config`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-eslint-config/CHANGELOG.md#2XY)
- [`@remix-run/express`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-express/CHANGELOG.md#2XY)
- [`@remix-run/node`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-node/CHANGELOG.md#2XY)
- [`@remix-run/react`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-react/CHANGELOG.md#2XY)
- [`@remix-run/serve`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-serve/CHANGELOG.md#2XY)
- [`@remix-run/server-runtime`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-server-runtime/CHANGELOG.md#2XY)
- [`@remix-run/testing`](https://github.com/remix-run/remix/blob/remix%402.X.Y/packages/remix-testing/CHANGELOG.md#2XY)

**Full Changelog**: [`v2.X.Y...v2.X.Y`](https://github.com/remix-run/remix/compare/remix@2.X.Y...remix@2.X.Y)

-->

## v2.4.0

### What's Changed

#### Client Data

We're excited to land the [Client Data RFC](https://github.com/remix-run/remix/discussions/7634) in this release! The final API differs slightly from the RFC, so please check out the docs for use-cases and final APIs:

- [Client Data Guide](https://remix.run/guides/client-data)
- [`clientLoader`](https://remix.run/route/client-loader)
- [`HydrateFallback`](https://remix.run/route/hydrate-fallback)
- [`clientAction`](https://remix.run/route/client-loader)

While we still recommend server loaders/actions for the majority of your data needs in a Remix app - these provide some levers you can pull for more advanced use-cases such as:

- **Skip the Hop:** Query a data API directly from the browser, using loaders simply for SSR
- **Fullstack State:** Augment server data with client data for your full set of loader data
- **One or the Other:** Sometimes you use server loaders, sometimes you use client loaders, but not both on one route
- **Client Cache:** Cache server loader data in the client and avoid some server calls
- **Migration:** Ease your migration from React Router -> Remix SPA -> Remix SSR

#### `future.v3_relativeSplatPath`

We introduced a `future.v3_relativeSplatPath` flag to implement a breaking bug fix to relative routing when inside a splat route. For more information, please see the React Router [`6.21.0` Release Notes](https://github.com/remix-run/react-router/blob/main/CHANGELOG.md#futurev7_relativesplatpath) and the [`useResolvedPath` docs](https://remix.run/hooks/use-resolved-path#splat-paths)

#### Vite Updates (Unstable)

Remix now excludes modules within `.server` directories from client build.

Remix now enforces strict route exports, and will will throw an error if you have unsupported exports in your route modules. Previously, the Remix compiler would allow any export from routes. While this was convenient, it was also a common source of bugs that were hard to track down because they only surfaced at runtime. For more information, please see [the docs](https://remix.run/docs/en/main/future/vite#strict-route-exports).

### Minor Changes

- Add support for `clientLoader`/`clientAction`/`HydrateFallback` route exports ([#8173](https://github.com/remix-run/remix/pull/8173))
- Add a new `future.v3_relativeSplatPath` flag to implement a breaking bug fix to relative routing when inside a splat route ([#8216](https://github.com/remix-run/remix/pull/8216))
- Deprecate `DataFunctionArgs` in favor of `LoaderFunctionArgs`/`ActionFunctionArgs` ([#8173](https://github.com/remix-run/remix/pull/8173))
  - This is aimed at keeping the types aligned across server/client loaders/actions now that `clientLoader`/`clientActon` functions have `serverLoader`/`serverAction` parameters which differentiate `ClientLoaderFunctionArgs`/`ClientActionFunctionArgs`
- Vite: Exclude modules within `.server` directories from client build ([#8154](https://github.com/remix-run/remix/pull/8154))
- Vite: Strict route exports ([#8171](https://github.com/remix-run/remix/pull/8171))

### Patch Changes

- `@remix-run/server-runtime`: Fix flash of unstyled content for non-Express custom servers in Vite dev ([#8076](https://github.com/remix-run/remix/pull/8076))
- `@remix-run/server-runtime`: Pass request handler errors to `vite.ssrFixStacktrace` in Vite dev to ensure stack traces correctly map to the original source code ([#8066](https://github.com/remix-run/remix/pull/8066))
- `remix-serve`: Fix source map loading when file has `?t=timestamp` suffix (rebuilds) ([#8174](https://github.com/remix-run/remix/pull/8174))
- `@remix-run/dev`: Change Vite build output paths to fix a conflict between how Vite and the Remix compiler each manage the `public` directory ([#8077](https://github.com/remix-run/remix/pull/8077))
  - ⚠️ **This is a breaking change for projects using the unstable Vite plugin**
  - The server is now compiled into `build/server` rather than `build`, and the client is now compiled into `build/client` rather than `public`
  - For more information on the changes and guidance on how to migrate your project, refer to the updated [Remix Vite documentation](https://remix.run/future/vite)
- `@remix-run/dev`: Upgrade Vite peer dependency range to v5 ([#8172](https://github.com/remix-run/remix/pull/8172))
- `@remix-run/dev`: Support HMR for routes with `handle` export in Vite dev ([#8022](https://github.com/remix-run/remix/pull/8022))
- `@remix-run/dev`: Fix flash of unstyled content for non-Express custom servers in Vite dev ([#8076](https://github.com/remix-run/remix/pull/8076))
- `@remix-run/dev`: Bundle CSS imported in client entry file in Vite plugin ([#8143](https://github.com/remix-run/remix/pull/8143))
- `@remix-run/dev`: Remove undocumented `legacyCssImports` option from Vite plugin due to issues with `?url` imports of CSS files not being processed correctly in Vite ([#8096](https://github.com/remix-run/remix/pull/8096))
- `@remix-run/dev`: Vite: fix access to default `entry.{client,server}.tsx` within `pnpm` workspaces on Windows ([#8057](https://github.com/remix-run/remix/pull/8057))
- `@remix-run/dev`: Remove `unstable_createViteServer` and `unstable_loadViteServerBuild` which were only minimal wrappers around Vite's `createServer` and `ssrLoadModule` functions when using a custom server ([#8120](https://github.com/remix-run/remix/pull/8120))

  - ⚠️ **This is a breaking change for projects using the unstable Vite plugin with a custom server.**
  - Instead, we now provide `unstable_viteServerBuildModuleId` so that custom servers interact with Vite directly rather than via Remix APIs, for example:

    ```diff
    -import {
    -  unstable_createViteServer,
    -  unstable_loadViteServerBuild,
    -} from "@remix-run/dev";
    +import { unstable_viteServerBuildModuleId } from "@remix-run/dev";
    ```

    Creating the Vite server in middleware mode:

    ```diff
    const vite =
      process.env.NODE_ENV === "production"
        ? undefined
    -    : await unstable_createViteServer();
    +    : await import("vite").then(({ createServer }) =>
    +        createServer({
    +          server: {
    +            middlewareMode: true,
    +          },
    +        })
    +      );
    ```

    Loading the Vite server build in the request handler:

    ```diff
    app.all(
      "*",
      createRequestHandler({
        build: vite
    -      ? () => unstable_loadViteServerBuild(vite)
    +      ? () => vite.ssrLoadModule(unstable_viteServerBuildModuleId)
          : await import("./build/server/index.js"),
      })
    );
    ```

- `@remix-run/dev`: Pass request handler errors to `vite.ssrFixStacktrace` in Vite dev to ensure stack traces correctly map to the original source code ([#8066](https://github.com/remix-run/remix/pull/8066))
- `@remix-run/dev`: Vite: Preserve names for exports from `.client` imports ([#8200](https://github.com/remix-run/remix/pull/8200))
  - Unlike `.server` modules, the main idea is not to prevent code from leaking into the server build since the client build is already public
  - Rather, the goal is to isolate the SSR render from client-only code
  - Routes need to import code from `.client` modules without compilation failing and then rely on runtime checks to determine if the code is running on the server or client
  - Replacing `.client` modules with empty modules would cause the build to fail as ESM named imports are statically analyzed
    - So instead, we preserve the named export but replace each exported value with an empty object
    - That way, the import is valid at build time and the standard runtime checks can be used to determine if then code is running on the server or client
- `@remix-run/dev`: Add `@remix-run/node` to Vite's `optimizeDeps.include` array ([#8177](https://github.com/remix-run/remix/pull/8177))
- `@remix-run/dev`: Improve Vite plugin performance ([#8121](https://github.com/remix-run/remix/pull/8121))
  - Parallelize detection of route module exports
  - Disable `server.preTransformRequests` in Vite child compiler since it's only used to process route modules
- `@remix-run/dev`: Remove automatic global Node polyfill installation from the built-in Vite dev server and instead allow explicit opt-in ([#8119](https://github.com/remix-run/remix/pull/8119))

  - ⚠️ **This is a breaking change for projects using the unstable Vite plugin without a custom server.**
  - If you're not using a custom server, you should call `installGlobals` in your Vite config instead.

    ```diff
    import { unstable_vitePlugin as remix } from "@remix-run/dev";
    +import { installGlobals } from "@remix-run/node";
    import { defineConfig } from "vite";

    +installGlobals();

    export default defineConfig({
      plugins: [remix()],
    });
    ```

- `@remix-run/dev`: Vite: Errors at build-time when client imports .server default export ([#8184](https://github.com/remix-run/remix/pull/8184))
  - Remix already stripped .server file code before ensuring that server code never makes it into the client
  - That results in errors when client code tries to import server code, which is exactly what we want!
  - But those errors were happening at runtime for default imports
  - A better experience is to have those errors happen at build-time so that you guarantee that your users won't hit them
- `@remix-run/dev`: Fix `request instanceof Request` checks when using Vite dev server ([#8062](https://github.com/remix-run/remix/pull/8062))

### Updated Dependencies

- [`react-router-dom@6.21.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.21.0)
- [`@remix-run/router@1.14.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#1140)
- [`@remix-run/web-fetch@4.4.2`](https://github.com/remix-run/web-std-io/releases/tag/%40remix-run%2Fweb-fetch%404.4.2)

### Changes by Package

- [`create-remix`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/create-remix/CHANGELOG.md#240)
- [`@remix-run/architect`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-architect/CHANGELOG.md#240)
- [`@remix-run/cloudflare`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-cloudflare/CHANGELOG.md#240)
- [`@remix-run/cloudflare-pages`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-cloudflare-pages/CHANGELOG.md#240)
- [`@remix-run/cloudflare-workers`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-cloudflare-workers/CHANGELOG.md#240)
- [`@remix-run/css-bundle`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-css-bundle/CHANGELOG.md#240)
- [`@remix-run/deno`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-deno/CHANGELOG.md#240)
- [`@remix-run/dev`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-dev/CHANGELOG.md#240)
- [`@remix-run/eslint-config`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-eslint-config/CHANGELOG.md#240)
- [`@remix-run/express`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-express/CHANGELOG.md#240)
- [`@remix-run/node`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-node/CHANGELOG.md#240)
- [`@remix-run/react`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-react/CHANGELOG.md#240)
- [`@remix-run/serve`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-serve/CHANGELOG.md#240)
- [`@remix-run/server-runtime`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-server-runtime/CHANGELOG.md#240)
- [`@remix-run/testing`](https://github.com/remix-run/remix/blob/remix%402.4.0/packages/remix-testing/CHANGELOG.md#240)

**Full Changelog**: [`v2.3.1...v2.4.0`](https://github.com/remix-run/remix/compare/remix@2.3.1...remix@2.4.0)

## v2.3.1

### Patch Changes

- `@remix-run/dev`: Support `nonce` prop on `LiveReload` component in Vite dev ([#8014](https://github.com/remix-run/remix/pull/8014))
- `@remix-run/dev`: Ensure code-split JS files in the server build's assets directory aren't cleaned up after Vite build ([#8042](https://github.com/remix-run/remix/pull/8042))
- `@remix-run/dev`: Fix redundant copying of assets from `public` directory in Vite build ([#8039](https://github.com/remix-run/remix/pull/8039))
  - This ensures that static assets aren't duplicated in the server build directory
  - This also fixes an issue where the build would break if `assetsBuildDirectory` was deeply nested within the `public` directory

### Updated Dependencies

- [`react-router-dom@6.20.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.20.0)
- [`@remix-run/router@1.13.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#1130)

### Changes by Package

- [`create-remix`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/create-remix/CHANGELOG.md#231)
- [`@remix-run/architect`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-architect/CHANGELOG.md#231)
- [`@remix-run/cloudflare`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-cloudflare/CHANGELOG.md#231)
- [`@remix-run/cloudflare-pages`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-cloudflare-pages/CHANGELOG.md#231)
- [`@remix-run/cloudflare-workers`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-cloudflare-workers/CHANGELOG.md#231)
- [`@remix-run/css-bundle`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-css-bundle/CHANGELOG.md#231)
- [`@remix-run/deno`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-deno/CHANGELOG.md#231)
- [`@remix-run/dev`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-dev/CHANGELOG.md#231)
- [`@remix-run/eslint-config`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-eslint-config/CHANGELOG.md#231)
- [`@remix-run/express`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-express/CHANGELOG.md#231)
- [`@remix-run/node`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-node/CHANGELOG.md#231)
- [`@remix-run/react`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-react/CHANGELOG.md#231)
- [`@remix-run/serve`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-serve/CHANGELOG.md#231)
- [`@remix-run/server-runtime`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-server-runtime/CHANGELOG.md#231)
- [`@remix-run/testing`](https://github.com/remix-run/remix/blob/remix%402.3.1/packages/remix-testing/CHANGELOG.md#231)

**Full Changelog**: [`v2.3.0...v2.3.1`](https://github.com/remix-run/remix/compare/remix@2.3.0...remix@2.3.1)

## v2.3.0

### What's Changed

#### Stabilized `useBlocker`

We've removed the `unstable_` prefix from the [`useBlocker`](https://remix.run/hooks/use-blocker) hook as it's been in use for enough time that we are confident in the API. We do not plan to remove the prefix from [`unstable_usePrompt`](https://remix.run/hooks/use-prompt) due to differences in how browsers handle `window.confirm` that prevent React Router from guaranteeing consistent/correct behavior.

#### `unstable_flushSync` API

We've added a new `unstable_flushSync` option to the imperative APIs (`useSubmit`, `useNavigate`, `fetcher.submit`, `fetcher.load`) to let users opt-into synchronous DOM updates for pending/optimistic UI.

```js
function handleClick() {
  submit(data, { flushSync: true });
  // Everything is flushed to the DOM so you can focus/scroll to your pending/optimistic UI
  setFocusAndOrScrollToNewlyAddedThing();
}
```

### Minor Changes

- Remove the `unstable_` prefix from the [`useBlocker`](https://reactrouter.com/en/main/hooks/use-blocker) hook ([#7882](https://github.com/remix-run/remix/pull/7882))
- Add `unstable_flushSync` option to `useNavigate`/`useSubmit`/`fetcher.load`/`fetcher.submit` to opt-out of `React.startTransition` and into `ReactDOM.flushSync` for state updates ([#7996](https://github.com/remix-run/remix/pull/7996))

### Patch Changes

- `@remix-run/react`: Add missing `modulepreload` for the manifest ([#7684](https://github.com/remix-run/remix/pull/7684))
- `@remix-run/server-runtime`: Updated `cookie` dependency from `0.4.1` to [`0.5.0`](https://github.com/jshttp/cookie/blob/v0.5.0/HISTORY.md#050--2022-04-11) to inherit support for `Priority` attribute in Chrome ([#6770](https://github.com/remix-run/remix/pull/6770))
- `@remix-run/dev`: Fix `FutureConfig` type ([#7895](https://github.com/remix-run/remix/pull/7895))
- _Lots_ of small fixes for the unstable `vite` compiler:
  - Support optional rendering of the `LiveReload` component in Vite dev ([#7919](https://github.com/remix-run/remix/pull/7919))
  - Support rendering of the `LiveReload` component after `Scripts` in Vite dev ([#7919](https://github.com/remix-run/remix/pull/7919))
  - Fix `react-refresh/babel` resolution for custom server with `pnpm` ([#7904](https://github.com/remix-run/remix/pull/7904))
  - Support JSX usage in `.jsx` files without manual `React` import in Vite ([#7888](https://github.com/remix-run/remix/pull/7888))
  - Fix Vite production builds when plugins that have different local state between `development` and `production` modes are present (e.g. `@mdx-js/rollup`) ([#7911](https://github.com/remix-run/remix/pull/7911))
  - Cache resolution of Remix Vite plugin options ([#7908](https://github.com/remix-run/remix/pull/7908))
  - Support Vite 5 ([#7846](https://github.com/remix-run/remix/pull/7846))
  - Allow `process.env.NODE_ENV` values other than `"development"` in Vite dev ([#7980](https://github.com/remix-run/remix/pull/7980))
  - Attach CSS from shared chunks to routes in Vite build ([#7952](https://github.com/remix-run/remix/pull/7952))
  - Let Vite handle serving files outside of project root via `/@fs` ([#7913](https://github.com/remix-run/remix/pull/7913))
    - This fixes errors when using default client entry or server entry in a pnpm project where those files may be outside of the project root, but within the workspace root
    - By default, Vite prevents access to files outside the workspace root (when using workspaces) or outside of the project root (when not using workspaces) unless user explicitly opts into it via Vite's `server.fs.allow`
  - Improve performance of LiveReload proxy in Vite dev ([#7883](https://github.com/remix-run/remix/pull/7883))
  - Deduplicate `@remix-run/react` ([#7926](https://github.com/remix-run/remix/pull/7926))
    - Pre-bundle Remix dependencies to avoid Remix router duplicates
    - Our `remix-react-proxy` plugin does not process default client and server entry files since those come from within `node_modules`
    - That means that before Vite pre-bundles dependencies (e.g. first time dev server is run) mismatching Remix routers cause `Error: You must render this element inside a <Remix> element`
  - Fix React Fast Refresh error on load when using `defer` in Vite dev server ([#7842](https://github.com/remix-run/remix/pull/7842))
  - Handle multiple `Set-Cookie` headers in Vite dev server ([#7843](https://github.com/remix-run/remix/pull/7843))
  - Fix flash of unstyled content on initial page load in Vite dev when using a custom Express server ([#7937](https://github.com/remix-run/remix/pull/7937))
  - Populate `process.env` from `.env` files on the server in Vite dev ([#7958](https://github.com/remix-run/remix/pull/7958))
  - Emit assets that were only referenced in the server build into the client assets directory in Vite build ([#7892](https://github.com/remix-run/remix/pull/7892), cherry-picked in [`8cd31d65`](https://github.com/remix-run/remix/commit/8cd31d6543ef4c765220fc64dca9bcc9c61ee9eb))

### Updated Dependencies

- [`react-router-dom@6.19.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.19.0)
- [`@remix-run/router@1.12.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#1120)

### Changes by Package

- [`create-remix`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/create-remix/CHANGELOG.md#230)
- [`@remix-run/architect`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-architect/CHANGELOG.md#230)
- [`@remix-run/cloudflare`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-cloudflare/CHANGELOG.md#230)
- [`@remix-run/cloudflare-pages`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-cloudflare-pages/CHANGELOG.md#230)
- [`@remix-run/cloudflare-workers`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-cloudflare-workers/CHANGELOG.md#230)
- [`@remix-run/css-bundle`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-css-bundle/CHANGELOG.md#230)
- [`@remix-run/deno`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-deno/CHANGELOG.md#230)
- [`@remix-run/dev`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-dev/CHANGELOG.md#230)
- [`@remix-run/eslint-config`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-eslint-config/CHANGELOG.md#230)
- [`@remix-run/express`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-express/CHANGELOG.md#230)
- [`@remix-run/node`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-node/CHANGELOG.md#230)
- [`@remix-run/react`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-react/CHANGELOG.md#230)
- [`@remix-run/serve`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-serve/CHANGELOG.md#230)
- [`@remix-run/server-runtime`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-server-runtime/CHANGELOG.md#230)
- [`@remix-run/testing`](https://github.com/remix-run/remix/blob/remix%402.3.0/packages/remix-testing/CHANGELOG.md#230)

**Full Changelog**: [`v2.2.0...v2.3.0`](https://github.com/remix-run/remix/compare/remix@2.2.0...remix@2.3.0)

## v2.2.0

### What's Changed

#### Vite!

Remix `2.2.0` adds unstable support for Vite for Node-based apps! See our [announcement blog post](https://remix.run/blog/remix-heart-vite) and the [_Future > Vite_ page in the Remix docs](https://remix.run/docs/en/2.2.0/future/vite) for more details.

You can try it out today with two new (unstable) templates:

```shellscript
# minimal server
npx create-remix@latest --template remix-run/remix/templates/unstable-vite

# custom server (Express example)
npx create-remix@latest --template remix-run/remix/templates/unstable-vite-express
```

- **New APIs in `@remix-run/dev`**
  - `unstable_vitePlugin`: The new Remix Vite plugin
  - `unstable_createViteServer`: Creates a Vite server in middleware mode for interop with custom servers
  - `unstable_loadViteServerBuild`: Allows your custom server to delegate SSR requests to Vite during development
- **Changed APIs**
  - `createRequestHandler`: Now also allows the `build` argument to be a function that will be used to dynamically load new builds for each request during development
- **Other Runtimes**
  - Deno support is untested, but should work through Deno's Node/`npm` interop
  - CloudFlare support is not yet available

#### New Fetcher APIs

Per this [RFC](https://github.com/remix-run/remix/discussions/7698), we've introduced some new APIs that give you more granular control over your fetcher behaviors:

- You may now specify your own fetcher identifier via `useFetcher({ key: string })`, which allows you to access the same fetcher instance from different components in your application without prop-drilling
- Fetcher keys are now exposed on the fetchers returned from `useFetchers` so that they can be looked up by `key`
- `Form` and `useSubmit` now support optional `navigate`/`fetcherKey` props/params to allow kicking off a fetcher submission under the hood with an optionally user-specified `key`
  - `<Form method="post" navigate={false} fetcherKey="my-key">`
  - `submit(data, { method: "post", navigate: false, fetcherKey: "my-key" })`
  - Invoking a fetcher in this way is ephemeral and stateless
  - If you need to access the state of one of these fetchers, you will need to leverage `useFetchers()` or `useFetcher({ key })` to look it up elsewhere

#### Persistence Future Flag

Per the same [RFC](https://github.com/remix-run/remix/discussions/7698) as above, we've introduced a new `future.v3_fetcherPersist` flag that allows you to opt-into the new fetcher persistence/cleanup behavior. Instead of being immediately cleaned up on unmount, fetchers will persist until they return to an `idle` state. This makes pending/optimistic UI _much_ easier in scenarios where the originating fetcher needs to unmount.

- This is sort of a long-standing bug fix as the `useFetchers()` API was always supposed to only reflect **in-flight** fetcher information for pending/optimistic UI -- it was not intended to reflect fetcher data or hang onto fetchers after they returned to an `idle` state
- Keep an eye out for the following specific behavioral changes when opting into this flag and check your app for compatibility:
  - Fetchers that complete _while still mounted_ will no longer appear in `useFetchers()` after completion - they served no purpose in there since you can access the data via `useFetcher().data`
  - Fetchers that previously unmounted _while in-flight_ will not be immediately aborted and will instead be cleaned up once they return to an `idle` state
    - They will remain exposed via `useFetchers` while in-flight so you can still access pending/optimistic data after unmount
    - If a fetcher is no longer mounted when it completes, then it's result will not be post processed - e.g., redirects will not be followed and errors will not bubble up in the UI
    - However, if a fetcher was re-mounted elsewhere in the tree using the same `key`, then it's result will be processed, even if the originating fetcher was unmounted

### Minor Changes

- Unstable `vite` support ([#7590](https://github.com/remix-run/remix/pull/7590))
- New fetcher `key` APIs and `navigate`/`fetcherKey` params for navigational APIs ([#10960](https://github.com/remix-run/react-router/pull/10960))
- New `future.v3_fetcherPersist` flag ([#10962](https://github.com/remix-run/react-router/pull/10962))

### Patch Changes

- `@remix-run/express`: Allow the Express adapter to work behind a proxy when using `app.enable('trust proxy')` ([#7323](https://github.com/remix-run/remix/pull/7323))
  - Previously, this used `req.get('host')` to construct the Remix `Request`, but that does not respect `X-Forwarded-Host`
  - This now uses `req.hostname` which will respect `X-Forwarded-Host`
- `@remix-run/react`: Fix warning that could be inadvertently logged when using route files with no `default` export ([#7745](https://github.com/remix-run/remix/pull/7745))
- `create-remix`: Support local tarballs with a `.tgz` extension which allows direct support for [`pnpm pack` tarballs](https://pnpm.io/cli/pack) ([#7649](https://github.com/remix-run/remix/pull/7649))
- `create-remix`: Default the Remix app version to the version of `create-remix` being used ([#7670](https://github.com/remix-run/remix/pull/7670))
  - This most notably enables easier usage of tags, e.g. `npm create remix@nightly`

### Updated Dependencies

- [`react-router-dom@6.18.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.18.0)
- [`@remix-run/router@1.11.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#1110)

### Changes by Package

- [`create-remix`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/create-remix/CHANGELOG.md#220)
- [`@remix-run/architect`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-architect/CHANGELOG.md#220)
- [`@remix-run/cloudflare`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-cloudflare/CHANGELOG.md#220)
- [`@remix-run/cloudflare-pages`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-cloudflare-pages/CHANGELOG.md#220)
- [`@remix-run/cloudflare-workers`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-cloudflare-workers/CHANGELOG.md#220)
- [`@remix-run/css-bundle`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-css-bundle/CHANGELOG.md#220)
- [`@remix-run/deno`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-deno/CHANGELOG.md#220)
- [`@remix-run/dev`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-dev/CHANGELOG.md#220)
- [`@remix-run/eslint-config`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-eslint-config/CHANGELOG.md#220)
- [`@remix-run/express`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-express/CHANGELOG.md#220)
- [`@remix-run/node`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-node/CHANGELOG.md#220)
- [`@remix-run/react`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-react/CHANGELOG.md#220)
- [`@remix-run/serve`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-serve/CHANGELOG.md#220)
- [`@remix-run/server-runtime`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-server-runtime/CHANGELOG.md#220)
- [`@remix-run/testing`](https://github.com/remix-run/remix/blob/remix%402.2.0/packages/remix-testing/CHANGELOG.md#220)

**Full Changelog**: [`v2.1.0...v2.2.0`](https://github.com/remix-run/remix/compare/remix@2.1.0...remix@2.2.0)

## v2.1.0

### What's Changed

#### View Transitions

We're excited to release experimental support for the the [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition) in Remix! You can now trigger navigational DOM updates to be wrapped in `document.startViewTransition` to enable CSS animated transitions on SPA navigations in your application.

The simplest approach to enabling a View Transition in your Remix app is via the new [`<Link unstable_viewTransition>`](https://remix.run/docs/components/link#unstable_viewtransition) prop. This will cause the navigation DOM update to be wrapped in `document.startViewTransition` which will enable transitions for the DOM update. Without any additional CSS styles, you'll get a basic cross-fade animation for your page.

If you need to apply more fine-grained styles for your animations, you can leverage the [`unstable_useViewTransitionState`](https://remix.run/docs/hooks/use-view-transition-state) hook which will tell you when a transition is in progress and you can use that to apply classes or styles:

```jsx
function ImageLink(to, src, alt) {
  const isTransitioning = unstable_useViewTransitionState(to);
  return (
    <Link to={to} unstable_viewTransition>
      <img
        src={src}
        alt={alt}
        style={{
          viewTransitionName: isTransitioning ? "image-expand" : "",
        }}
      />
    </Link>
  );
}
```

You can also use the [`<NavLink unstable_viewTransition>`](https://remix.run/docs/components/nav-link#unstable_viewtransition) shorthand which will manage the hook usage for you and automatically add a `transitioning` class to the `<a>` during the transition:

```css
a.transitioning img {
  view-transition-name: "image-expand";
}
```

```jsx
<NavLink to={to} unstable_viewTransition>
  <img src={src} alt={alt} />
</NavLink>
```

For an example usage of View Transitions, check out [our fork](https://github.com/brophdawg11/react-router-records) of the [Astro Records](https://github.com/Charca/astro-records) demo (which uses React Router but so does Remix 😉).

For more information on using the View Transitions API, please refer to the [Smooth and simple transitions with the View Transitions API](https://developer.chrome.com/docs/web-platform/view-transitions/) guide from the Google Chrome team.

#### Stable `createRemixStub`

After real-world experience, we're confident in the [`createRemixStub`](https://remix.run/docs/utils/create-remix-stub) API and ready to commit to it, so in `2.1.0` we've removed the `unstable_` prefix.

⚠️ Please note that this did involve 1 _small_ breaking change - the `<RemixStub remixConfigFuture>` prop has been renamed to `<RemixStub future>` to decouple the `future` prop from a specific file location.

### Minor Changes

- Added unstable support for the View Transition API ([#10916](https://github.com/remix-run/react-router/pull/10916))
- Stabilized the `@remix-run/testing` `createRemixStub` helper ([#7647](https://github.com/remix-run/remix/pull/7647))

### Patch Changes

- Emulate types for `JSON.parse(JSON.stringify(x))` in `SerializeFrom` ([#7605](https://github.com/remix-run/remix/pull/7605))
  - Notably, type fields that are only assignable to `undefined` after serialization are now omitted since `JSON.stringify |> JSON.parse` will omit them. See test cases for examples
  - This fixes type errors when upgrading to v2 from 1.19
- Avoid mutating `meta` object when `tagName` is specified ([#7594](https://github.com/remix-run/remix/pull/7594))
- Fix FOUC on subsequent client-side navigations to `route.lazy` routes ([#7576](https://github.com/remix-run/remix/pull/7576))
- Export the proper Remix `useMatches` wrapper to fix `UIMatch` typings ([#7551](https://github.com/remix-run/remix/pull/7551))
- `@remix-run/cloudflare` - sourcemap takes into account special chars in output file ([#7574](https://github.com/remix-run/remix/pull/7574))
- `@remix-run/express` - Flush headers for `text/event-stream` responses ([#7619](https://github.com/remix-run/remix/pull/7619))

### Updated Dependencies

- [`react-router-dom@6.17.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.17.0)
- [`@remix-run/router@1.10.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#1100)

### Changes by Package

- [`create-remix`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/create-remix/CHANGELOG.md#210)
- [`@remix-run/architect`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-architect/CHANGELOG.md#210)
- [`@remix-run/cloudflare`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-cloudflare/CHANGELOG.md#210)
- [`@remix-run/cloudflare-pages`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-cloudflare-pages/CHANGELOG.md#210)
- [`@remix-run/cloudflare-workers`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-cloudflare-workers/CHANGELOG.md#210)
- [`@remix-run/css-bundle`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-css-bundle/CHANGELOG.md#210)
- [`@remix-run/deno`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-deno/CHANGELOG.md#210)
- [`@remix-run/dev`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-dev/CHANGELOG.md#210)
- [`@remix-run/eslint-config`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-eslint-config/CHANGELOG.md#210)
- [`@remix-run/express`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-express/CHANGELOG.md#210)
- [`@remix-run/node`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-node/CHANGELOG.md#210)
- [`@remix-run/react`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-react/CHANGELOG.md#210)
- [`@remix-run/serve`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-serve/CHANGELOG.md#210)
- [`@remix-run/server-runtime`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-server-runtime/CHANGELOG.md#210)
- [`@remix-run/testing`](https://github.com/remix-run/remix/blob/remix%402.1.0/packages/remix-testing/CHANGELOG.md#210)

**Full Changelog**: [`v2.0.1...v2.1.0`](https://github.com/remix-run/remix/compare/remix@2.0.1...remix@2.1.0)

## v2.0.1

### Patch Changes

- Fix types for MDX files when using pnpm ([#7491](https://github.com/remix-run/remix/pull/7491))
- Update `getDependenciesToBundle` to handle ESM packages without main exports ([#7272](https://github.com/remix-run/remix/pull/7272))
  - Note that these packages must expose `package.json` in their `exports` field so that their path can be resolved
- Fix server builds where `serverBuildPath` extension is `.cjs` ([#7180](https://github.com/remix-run/remix/pull/7180))
- Fix HMR for CJS projects using `remix-serve` and manual mode (`remix dev --manual`) ([#7487](https://github.com/remix-run/remix/pull/7487))
  - By explicitly busting the `require` cache, `remix-serve` now correctly re-imports new server changes in CJS
  - ESM projects were already working correctly and are not affected by this.
- Fix error caused by partially written server build ([#7470](https://github.com/remix-run/remix/pull/7470))
  - Previously, it was possible to trigger a reimport of the app server code before the new server build had completely been written. Reimporting the partially written server build caused issues related to `build.assets` being undefined and crashing when reading `build.assets.version`
- Add second generic to `UIMatch` for `handle` field ([#7464](https://github.com/remix-run/remix/pull/7464))
- Fix resource routes being loaded through `route.lazy` ([#7498](https://github.com/remix-run/remix/pull/7498))
- Throw a semantically correct 405 `ErrorResponse` instead of just an `Error` when submitting to a route without an `action` ([#7423](https://github.com/remix-run/remix/pull/7423))
- Update to latest version of `@remix-run/web-fetch` ([#7477](https://github.com/remix-run/remix/pull/7477))
- Switch from `crypto.randomBytes` to `crypto.webcrypto.getRandomValues` for file session storage ID generation ([#7203](https://github.com/remix-run/remix/pull/7203))
- Use native `Blob` class instead of polyfill ([#7217](https://github.com/remix-run/remix/pull/7217))

### Changes by Package 🔗

- [`@remix-run/dev`](https://github.com/remix-run/remix/blob/remix%402.0.1/packages/remix-dev/CHANGELOG.md#201)
- [`@remix-run/node`](https://github.com/remix-run/remix/blob/remix%402.0.1/packages/remix-node/CHANGELOG.md#201)
- [`@remix-run/react`](https://github.com/remix-run/remix/blob/remix%402.0.1/packages/remix-react/CHANGELOG.md#201)
- [`@remix-run/serve`](https://github.com/remix-run/remix/blob/remix%402.0.1/packages/remix-serve/CHANGELOG.md#201)

**Full Changelog**: [`v2.0.0...v2.0.1`](https://github.com/remix-run/remix/compare/remix@2.0.0...remix@2.0.1)

## v2.0.0

We're _**so**_ excited to release Remix v2 to you and we really hope this upgrade is one of the smoothest framework upgrades you've ever experienced! That was our primary goal with v2 - something we aimed to achieve through a heavy use of deprecation warnings and [Future Flags](https://remix.run/blog/future-flags) in Remix v1.

If you are on the latest `1.x` version and you've enabled all future flags and addressed all console warnings, then our hope is that you are 90% of the way to being upgraded for v2. There are always going to be a few things that we _can't_ put behind a flag (like breaking type changes) or come up at the very last moment and don't have time to add as a warning or flag in `1.x`.

If you're _not_ yet on the latest 1.x version we'd recommend first upgrading to that and resolving any flag/console warnings:

```sh
> npx upgrade-remix 1.19.3
```

### Breaking Changes

Below is a _very concise_ list of the breaking changes in v2.

- For the most thorough discussion of breaking changes, please read the [**Upgrading to v2**](https://remix.run/docs/en/main/start/v2) guide. This document provides a comprehensive walkthrough of the breaking changes that come along with v2 - and instructions on how to adapt your application to handle them
- For additional details, you can refer to the [Changes by Package](#changes-by-package) section below

#### Upgraded Dependency Requirements

Remix v2 has upgraded it's minimum version support for React and Node and now officially requires:

- React 18 ([#7121](https://github.com/remix-run/remix/pull/7121))
  - For information on upgrading to React 18, please see the React [upgrade guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)
- Node 18 or later ([#6939](https://github.com/remix-run/remix/pull/6939), [#7292](https://github.com/remix-run/remix/pull/7292))
  - For information on upgrading to Node 18, please see the Node [v18 announcement](https://nodejs.org/en/blog/announcements/v18-release-announce)
  - Please refer to the [Remix documentation](https://remix.run/docs/en/main/other-api/node#version-support) for an overview of when we drop support for Node versions

#### Removed Future Flags

The following future flags were removed and their behavior is now the default - you can remove all of these from your `remix.config.js` file.

- [`v2_dev`](https://remix.run/docs/en/main/start/v2#remix-dev) - New dev server with HMR+HDR ([#7002](https://github.com/remix-run/remix/pull/7002))
  - If you had configurations in `future.v2_dev` instead of just the boolean value (i.e., `future.v2_dev.port`), you can lift them into a root `dev` object in your `remix.config.js`
- [`v2_errorBoundary`](https://remix.run/docs/en/main/start/v2#catchboundary-and-errorboundary) - Removed `CatchBoundary` in favor of a singular `ErrorBoundary` ([#6906](https://github.com/remix-run/remix/pull/6906))
- [`v2_headers`](https://remix.run/docs/en/main/start/v2#route-headers) - Altered the logic for `headers` in nested route scenarios ([#6979](https://github.com/remix-run/remix/pull/6979))
- [`v2_meta`](https://remix.run/docs/en/main/start/v2#route-meta) - Altered the return format of `meta()` ([#6958](https://github.com/remix-run/remix/pull/6958))
- [`v2_normalizeFormMethod`](https://remix.run/docs/en/main/start/v2#formmethod) - Normalize `formMethod` APIs to uppercase ([#6875](https://github.com/remix-run/remix/pull/6875))
- [`v2_routeConvention`](https://remix.run/docs/en/main/start/v2#file-system-route-convention) - Routes use a flat route convention by default now ([#6969](https://github.com/remix-run/remix/pull/6969))

#### Breaking Changes/API Removals

##### With deprecation warnings

The following lists other breaking changes/API removals which had deprecation warnings in Remix v1. If you're on the latest `1.19.3` release without any console warnings, then you're probably good to go on all of these!

- `remix.config.js`
  - Renamed [`browserBuildDirectory`](https://remix.run/docs/en/main/start/v2#browserbuilddirectory) to `assetsBuildDirectory` ([#6900](https://github.com/remix-run/remix/pull/6900))
  - Removed [`devServerBroadcastDelay`](https://remix.run/docs/en/main/start/v2#devserverbroadcastdelay) ([#7063](https://github.com/remix-run/remix/pull/7063))
  - Renamed [`devServerPort`](https://remix.run/docs/en/main/start/v2#devserverport) to `dev.port` ([`000457e0`](https://github.com/remix-run/remix/commit/000457e0ae025d9b94e721af254c319e83438923))
    - Note that if you are opting into this in a `1.x` release, your config flag will be `future.v2_dev.port`, but on a stable `2.x` release it will be `dev.port`
  - Changed the default [`serverModuleFormat`](https://remix.run/docs/en/main/start/v2#servermoduleformat) from `cjs` to `esm` ([#6949](https://github.com/remix-run/remix/pull/6949))
  - Removed [`serverBuildTarget`](https://remix.run/docs/en/main/start/v2#serverbuildtarget) ([#6896](https://github.com/remix-run/remix/pull/6896))
  - Changed [`serverBuildDirectory`](https://remix.run/docs/en/main/start/v2#serverbuilddirectory) to `serverBuildPath` ([#6897](https://github.com/remix-run/remix/pull/6897))
  - Node built-ins are no longer polyfilled on the server by default, you must opt-into polyfills via [`serverNodeBuiltinsPolyfill`](https://remix.run/docs/en/main/start/v2#servernodebuiltinspolyfill) ([#6911](https://github.com/remix-run/remix/pull/6911)
- `@remix-run/react`
  - Removed [`useTransition`](https://remix.run/docs/en/main/start/v2#usetransition) ([#6870](https://github.com/remix-run/remix/pull/6870))
  - Removed [`fetcher.type`](https://remix.run/docs/en/main/start/v2#usefetcher) and flattened [`fetcher.submission`](https://remix.run/docs/en/main/start/v2#usefetcher) ([#6874](https://github.com/remix-run/remix/pull/6874))
    - `<fetcher.Form method="get">` is now more accurately categorized as `state:"loading"` instead of `state:"submitting"` to better align with the underlying GET request
  - Require camelCased versions of [`imagesrcset`/`imagesizes`](https://remix.run/docs/en/main/start/v2#links-imagesizes-and-imagesrcset) ([#6936](https://github.com/remix-run/remix/pull/6936))

##### Without deprecation warnings

Unfortunately, we didn't manage to get a deprecation warning on _every_ breaking change or API removal 🙃. Here's a list of remaining changes that you may need to look into to upgrade to v2:

- `remix.config.js`
  - Node built-ins are no longer polyfilled in the browser by default, you must opt-into polyfills via [`browserNodeBuiltinsPolyfill`](https://remix.run/docs/en/main/start/v2#browsernodebuiltinspolyfill) ([#7269](https://github.com/remix-run/remix/pull/7269))
  - PostCSS/Tailwind will be enabled by default if config files exist in your app, you may disable this via the [`postcss` and `tailwind`](https://remix.run/docs/en/main/start/v2#built-in-postcsstailwind-support) flags ([#6909](https://github.com/remix-run/remix/pull/6909))
- `@remix-run/cloudflare`
  - Remove `createCloudflareKVSessionStorage` ([#6898](https://github.com/remix-run/remix/pull/6898))
  - Drop `@cloudflare/workers-types` v2 & v3 support ([#6925](https://github.com/remix-run/remix/pull/6925))
- `@remix-run/dev`
  - Removed `REMIX_DEV_HTTP_ORIGIN` in favor of `REMIX_DEV_ORIGIN` ([#6963](https://github.com/remix-run/remix/pull/6963))
  - Removed `REMIX_DEV_SERVER_WS_PORT` in favor of `dev.port` or `--port` ([#6965](https://github.com/remix-run/remix/pull/6965))
  - Removed `--no-restart`/`restart` flag in favor of `--manual`/`manual` ([#6962](https://github.com/remix-run/remix/pull/6962))
  - Removed `--scheme`/`scheme` and `--host`/`host` in favor of `REMIX_DEV_ORIGIN` instead ([#6962](https://github.com/remix-run/remix/pull/6962))
  - Removed the `codemod` command ([#6918](https://github.com/remix-run/remix/pull/6918))
- `@remix-run/eslint-config`
  - Remove `@remix-run/eslint-config/jest` config ([#6903](https://github.com/remix-run/remix/pull/6903))
  - Remove magic imports ESLint warnings ([#6902](https://github.com/remix-run/remix/pull/6902))
- `@remix-run/netlify`
  - The [`@remix-run/netlify`](https://remix.run/docs/en/main/start/v2#netlify-adapter) adapter has been removed in favor of the Netlify official adapters ([#7058](https://github.com/remix-run/remix/pull/7058))
- `@remix-run/node`
  - `fetch` is no longer polyfilled by default - apps must call [`installGlobals()`](https://remix.run/docs/en/main/start/v2#installglobals) to install the polyfills ([#7009](https://github.com/remix-run/remix/pull/7009))
  - `fetch` and related APIs are no longer exported from `@remix-run/node` - apps should use the versions in the global namespace ([#7293](https://github.com/remix-run/remix/pull/7293))
  - Apps must call [`sourceMapSupport.install()`](https://remix.run/docs/en/main/start/v2#source-map-support) to setup source map support
- `@remix-run/react`
  - Remove `unstable_shouldReload` in favor of `shouldRevalidate` ([#6865](https://github.com/remix-run/remix/pull/6865))
- `@remix-run/serve`
  - `remix-serve` picks an open port if 3000 is taken and `PORT` is not specified ([#7278](https://github.com/remix-run/remix/pull/7278))
  - Integrate `manual` mode ([#7231](https://github.com/remix-run/remix/pull/7231))
  - Remove undocumented `createApp` Node API ([#7229](https://github.com/remix-run/remix/pull/7229))
  - Preserve dynamic imports in remix-serve for external bundle ([#7173](https://github.com/remix-run/remix/pull/7173))
- `@remix-run/vercel`
  - The [`@remix-run/vercel`](https://remix.run/docs/en/main/start/v2#vercel-adapter) adapter has been removed in favor of out of the box functionality provided by Vercel ([#7035](https://github.com/remix-run/remix/pull/7035))
- `create-remix`
  - Stop passing `isTypeScript` to `remix.init` script ([#7099](https://github.com/remix-run/remix/pull/7099))
- `remix`
  - Removed magic exports ([#6895](https://github.com/remix-run/remix/pull/6895))

##### Breaking Type Changes

- Removed `V2_` prefixes from `future.v2_meta` types as they are now the default behavior ([#6958](https://github.com/remix-run/remix/pull/6958))
  - `V2_MetaArgs` -> `MetaArgs`
  - `V2_MetaDescriptor` -> `MetaDescriptor`
  - `V2_MetaFunction` -> `MetaFunction`
  - `V2_MetaMatch` -> `MetaMatch`
  - `V2_MetaMatches` -> `MetaMatches`
  - `V2_ServerRuntimeMetaArgs` -> `ServerRuntimeMetaArgs`
  - `V2_ServerRuntimeMetaDescriptor` -> `ServerRuntimeMetaDescriptor`
  - `V2_ServerRuntimeMetaFunction` -> `ServerRuntimeMetaFunction`
  - `V2_ServerRuntimeMetaMatch` -> `ServerRuntimeMetaMatch`
  - `V2_ServerRuntimeMetaMatches` -> `ServerRuntimeMetaMatches`
- The following types were adjusted to prefer `unknown` over `any` and to align with underlying React Router types ([#7319](https://github.com/remix-run/remix/pull/7319)):
  - Renamed the `useMatches()` return type from `RouteMatch` to `UIMatch`
  - Renamed `LoaderArgs`/`ActionArgs` to `LoaderFunctionArgs`/`ActionFunctionArgs`
  - `AppData` changed from `any` to `unknown`
  - `Location["state"]` (`useLocation.state`) changed from `any` to `unknown`
  - `UIMatch["data"]` (`useMatches()[i].data`) changed from `any` to `unknown`
  - `UIMatch["handle"]` (`useMatches()[i].handle`) changed from `{ [k: string]: any }` to `unknown`
  - `Fetcher["data"]` (`useFetcher().data`) changed from `any` to `unknown`
  - `MetaMatch.handle` (used in `meta()`) changed from `any` to `unknown`
  - `AppData`/`RouteHandle` are no longer exported as they are just aliases for `unknown`

### New Features

- New [`create-remix`](https://remix.run/docs/en/main/other-api/create-remix) CLI ([#6887](https://github.com/remix-run/remix/pull/6887))
  - Most notably, this removes the dropdown to choose your template/stack in favor of the `--template` flag and our ever-growing list of [available templates](https://remix.run/docs/en/main/guides/templates)
  - Adds a new `--overwrite` flag ([#7062](https://github.com/remix-run/remix/pull/7062))
  - Supports the `bun` package manager ([#7074](https://github.com/remix-run/remix/pull/7074))
- Detect built mode via `build.mode` ([#6964](https://github.com/remix-run/remix/pull/6964))
- Support polyfilling node globals via `serverNodeBuiltinsPolyfill.globals`/`browserNodeBuiltinsPolyfill.globals` ([#7269](https://github.com/remix-run/remix/pull/7269))
- New `redirectDocument` utility to redirect via a fresh document load ([#7040](https://github.com/remix-run/remix/pull/7040), [#6842](https://github.com/remix-run/remix/pull/6842))
- Add `error` to `meta` params so you can render error titles, etc. ([#7105](https://github.com/remix-run/remix/pull/7105))
- `unstable_createRemixStub` now supports adding `meta`/`links` functions on stubbed Remix routes ([#7186](https://github.com/remix-run/remix/pull/7186))
  - `unstable_createRemixStub` no longer supports the `element`/`errorElement` properties on routes. You must use `Component`/`ErrorBoundary` to match what you would export from a Remix route module.

### Other Notable Changes

- Remix now uses React Router's `route.lazy` method internally to load route modules on navigations ([#7133](https://github.com/remix-run/remix/pull/7133))
- Removed the `@remix-run/node` `atob`/`btoa` polyfills in favor of the built-in versions ([#7206](https://github.com/remix-run/remix/pull/7206))
- Decouple the `@remix-run/dev` package from the contents of the `@remix-run/css-bundle` package ([#6982](https://github.com/remix-run/remix/pull/6982))
  - The contents of the `@remix-run/css-bundle` package are now entirely managed by the Remix compiler. Even though it's still recommended that your Remix dependencies all share the same version, this change ensures that there are no runtime errors when upgrading `@remix-run/dev` without upgrading `@remix-run/css-bundle`.
- `remix-serve` now picks an open port if 3000 is taken ([#7278](https://github.com/remix-run/remix/pull/7278))
  - If `PORT` env var is set, `remix-serve` will use that port
  - Otherwise, `remix-serve` picks an open port (3000 unless that is already taken)

### Updated Dependencies

- [`react-router-dom@6.16.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.16.0)
- [`@remix-run/router@1.9.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#190)
- [`@remix-run/web-fetch@4.4.0`](https://github.com/remix-run/web-std-io/releases/tag/%40remix-run%2Fweb-fetch%404.4.0)
- [`@remix-run/web-file@3.1.0`](https://github.com/remix-run/web-std-io/releases/tag/%40remix-run%2Fweb-file%403.1.0)
- [`@remix-run/web-stream@1.1.0`](https://github.com/remix-run/web-std-io/releases/tag/%40remix-run%2Fweb-stream%401.1.0)

### Changes by Package

- [`create-remix`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/create-remix/CHANGELOG.md#200)
- [`@remix-run/architect`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-architect/CHANGELOG.md#200)
- [`@remix-run/cloudflare`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-cloudflare/CHANGELOG.md#200)
- [`@remix-run/cloudflare-pages`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-cloudflare-pages/CHANGELOG.md#200)
- [`@remix-run/cloudflare-workers`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-cloudflare-workers/CHANGELOG.md#200)
- [`@remix-run/css-bundle`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-css-bundle/CHANGELOG.md#200)
- [`@remix-run/deno`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-deno/CHANGELOG.md#200)
- [`@remix-run/dev`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-dev/CHANGELOG.md#200)
- [`@remix-run/eslint-config`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-eslint-config/CHANGELOG.md#200)
- [`@remix-run/express`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-express/CHANGELOG.md#200)
- [`@remix-run/node`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-node/CHANGELOG.md#200)
- [`@remix-run/react`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-react/CHANGELOG.md#200)
- [`@remix-run/serve`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-serve/CHANGELOG.md#200)
- [`@remix-run/server-runtime`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-server-runtime/CHANGELOG.md#200)
- [`@remix-run/testing`](https://github.com/remix-run/remix/blob/remix%402.0.0/packages/remix-testing/CHANGELOG.md#200)
