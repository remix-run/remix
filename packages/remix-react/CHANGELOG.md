# `@remix-run/react`

## 2.8.1

### Patch Changes

- Strengthen the internal `LayoutComponent` type to accept limited children ([#8910](https://github.com/remix-run/remix/pull/8910))
- Updated dependencies:
  - `@remix-run/server-runtime@2.8.1`

## 2.8.0

### Patch Changes

- Fix the default root `ErrorBoundary` component so it leverages the user-provided `Layout` component ([#8859](https://github.com/remix-run/remix/pull/8859))
- Fix the default root `HydrateFallback` component so it leverages any user-provided `Layout` component ([#8892](https://github.com/remix-run/remix/pull/8892))
- Ensure `@remix-run/react` re-exports everything from `react-router-dom` for SPA mode ([#8929](https://github.com/remix-run/remix/pull/8929))
- Updated dependencies:
  - `@remix-run/server-runtime@2.8.0`

## 2.7.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.7.2`

## 2.7.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.7.1`

## 2.7.0

### Minor Changes

- Allow an optional `Layout` export from the root route ([#8709](https://github.com/remix-run/remix/pull/8709))
- Vite: Add a new `basename` option to the Vite plugin, allowing users to set the internal React Router [`basename`](https://reactrouter.com/en/main/routers/create-browser-router#basename) in order to to serve their applications underneath a subpath ([#8145](https://github.com/remix-run/remix/pull/8145))

### Patch Changes

- Fix a bug with SPA mode when the root route had no children ([#8747](https://github.com/remix-run/remix/pull/8747))
- Updated dependencies:
  - `@remix-run/server-runtime@2.7.0`

## 2.6.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.6.0`

## 2.5.1

### Patch Changes

- Only use active matches in `<Meta>`/`<Links>` in SPA mode ([#8538](https://github.com/remix-run/remix/pull/8538))
- Remove leftover `unstable_` prefix from `Blocker`/`BlockerFunction` types ([#8530](https://github.com/remix-run/remix/pull/8530))
- Updated dependencies:
  - `@remix-run/server-runtime@2.5.1`

## 2.5.0

### Minor Changes

- Add unstable support for "SPA Mode" ([#8457](https://github.com/remix-run/remix/pull/8457))

  You can opt into SPA Mode by setting `unstable_ssr: false` in your Remix Vite plugin config:

  ```js
  // vite.config.ts
  import { unstable_vitePlugin as remix } from "@remix-run/dev";
  import { defineConfig } from "vite";

  export default defineConfig({
    plugins: [remix({ unstable_ssr: false })],
  });
  ```

  Development in SPA Mode is just like a normal Remix app, and still uses the Remix dev server for HMR/HDR:

  ```sh
  remix vite:dev
  ```

  Building in SPA Mode will generate an `index.html` file in your client assets directory:

  ```sh
  remix vite:build
  ```

  To run your SPA, you serve your client assets directory via an HTTP server:

  ```sh
  npx http-server build/client
  ```

  For more information, please refer to the [SPA Mode docs](https://remix.run/future/spa-mode).

### Patch Changes

- Vite: Fix type conflict with `import.meta.hot` from the existing Remix compiler ([#8459](https://github.com/remix-run/remix/pull/8459))
- Updated dependencies:
  - `@remix-run/server-runtime@2.5.0`

## 2.4.1

### Patch Changes

- Propagate server `loader` errors through `serverLoader` in hydrating `clientLoader`'s ([#8304](https://github.com/remix-run/remix/pull/8304))
- Re-export `Response` helpers (`defer`/`json`/`redirect`/`redirectDocument`) through `@remix-run/react` for use in `clientLoader`/`clientAction` ([#8351](https://github.com/remix-run/remix/pull/8351))
- Updated dependencies:
  - `@remix-run/server-runtime@2.4.1`

## 2.4.0

### Minor Changes

- Add support for `clientLoader`/`clientAction`/`HydrateFallback` route exports ([RFC](https://github.com/remix-run/remix/discussions/7634)). ([#8173](https://github.com/remix-run/remix/pull/8173))

  Remix now supports loaders/actions that run on the client (in addition to, or instead of the loader/action that runs on the server). While we still recommend server loaders/actions for the majority of your data needs in a Remix app - these provide some levers you can pull for more advanced use-cases such as:

  - Leveraging a data source local to the browser (i.e., `localStorage`)
  - Managing a client-side cache of server data (like `IndexedDB`)
  - Bypassing the Remix server in a BFF setup and hitting your API directly from the browser
  - Migrating a React Router SPA to a Remix application

  By default, `clientLoader` will not run on hydration, and will only run on subsequent client side navigations.

  If you wish to run your client loader on hydration, you can set `clientLoader.hydrate=true` to force Remix to execute it on initial page load. Keep in mind that Remix will still SSR your route component so you should ensure that there is no new _required_ data being added by your `clientLoader`.

  If your `clientLoader` needs to run on hydration and adds data you require to render the route component, you can export a `HydrateFallback` component that will render during SSR, and then your route component will not render until the `clientLoader` has executed on hydration.

  `clientAction` is simpler than `clientLoader` because it has no hydration use-cases. `clientAction` will only run on client-side navigations.

  For more information, please refer to the [`clientLoader`](https://remix.run/route/client-loader) and [`clientAction`](https://remix.run/route/client-action) documentation.

- Add a new `future.v3_relativeSplatPath` flag to implement a breaking bug fix to relative routing when inside a splat route. For more information, please see the React Router [`6.21.0` Release Notes](https://github.com/remix-run/react-router/blob/release-next/CHANGELOG.md#futurev7_relativesplatpath) and the [`useResolvedPath` docs](https://remix.run/hooks/use-resolved-path#splat-paths). ([#8216](https://github.com/remix-run/remix/pull/8216))

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.4.0`

## 2.3.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.3.1`

## 2.3.0

### Minor Changes

- Remove the `unstable_` prefix from the [`useBlocker`](https://reactrouter.com/en/main/hooks/use-blocker) hook as it's been in use for enough time that we are confident in the API. We do not plan to remove the prefix from `unstable_usePrompt` due to differences in how browsers handle `window.confirm` that prevent React Router from guaranteeing consistent/correct behavior. ([#7882](https://github.com/remix-run/remix/pull/7882))

### Patch Changes

- Support rendering of `LiveReload` component after `Scripts` in Vite dev ([#7919](https://github.com/remix-run/remix/pull/7919))
- Support optional rendering of `LiveReload` component in Vite dev ([#7919](https://github.com/remix-run/remix/pull/7919))
- add missing modulepreload for the manifest ([#7684](https://github.com/remix-run/remix/pull/7684))
- Updated dependencies:
  - [`react-router-dom@6.19.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.19.0)
  - [`@remix-run/router@1.12.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#1120)
  - `@remix-run/server-runtime@2.3.0`

## 2.2.0

### Minor Changes

- Unstable Vite support for Node-based Remix apps ([#7590](https://github.com/remix-run/remix/pull/7590))
  - `remix build` 👉 `vite build && vite build --ssr`
  - `remix dev` 👉 `vite dev`
  - Other runtimes (e.g. Deno, Cloudflare) not yet supported.
  - See "Future > Vite" in the Remix Docs for details
- Add a new `future.v3_fetcherPersist` flag to change the persistence behavior of fetchers. Instead of being immediately cleaned up when unmounted in the UI, fetchers will persist until they return to an `idle` state ([RFC](https://github.com/remix-run/remix/discussions/7698)) ([#7704](https://github.com/remix-run/remix/pull/7704))
  - For more details, please refer to the [React Router 6.18.0](https://github.com/remix-run/react-router/releases/tag/react-router%406.18.0) release notes

### Patch Changes

- Fix warning that could be logged when using route files with no `default` export ([#7745](https://github.com/remix-run/remix/pull/7745))
  - It seems our compiler compiles these files to export an empty object as the `default` which we can then end up passing to `React.createElement`, triggering the console warning, but generally no UI issues
  - By properly detecting these, we can correctly pass `Component: undefined` off to the React Router layer
  - This is technically an potential issue in the compiler but it's an easy patch in the `@remix-run/react` layer and hopefully disappears in a Vite world
- Fix critical CSS hydration errors for Vite dev ([#7812](https://github.com/remix-run/remix/pull/7812))
- Updated dependencies:
  - `@remix-run/server-runtime@2.2.0`
  - [`react-router-dom@6.18.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.18.0)
  - [`@remix-run/router@1.11.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#1110)

## 2.1.0

### Minor Changes

- Add experimental support for the [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition) via `document.startViewTransition` to enable CSS animated transitions on SPA navigations in your application ([#7648](https://github.com/remix-run/remix/pull/7648))
  - For additional information please refer to the [2.1.0 Release Notes](https://github.com/remix-run/remix/releases/tag/remix%402.1.0) or the [documentation](https://remix.run/docs/components/link#unstable_viewtransition)

### Patch Changes

- Avoid mutating `meta` object when `tagName` is specified ([#7594](https://github.com/remix-run/remix/pull/7594))
- Fix FOUC on subsequent client-side navigations to `route.lazy` routes ([#7576](https://github.com/remix-run/remix/pull/7576))
- Emulate types for `JSON.parse(JSON.stringify(x))` in `SerializeFrom` ([#7605](https://github.com/remix-run/remix/pull/7605))
  - Notably, type fields that are only assignable to `undefined` after serialization are now omitted since `JSON.stringify |> JSON.parse` will omit them -- see test cases for examples
  - Also fixes type errors when upgrading to v2 from 1.19
- Export the proper Remix `useMatches` wrapper to fix `UIMatch` typings ([#7551](https://github.com/remix-run/remix/pull/7551))
- Updated dependencies:
  - `@remix-run/server-runtime@2.1.0`
  - [`react-router-dom@6.17.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.17.0)
  - [`@remix-run/router@1.10.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#1100)

## 2.0.1

### Patch Changes

- Add second generic to `UIMatch` for `handle` field ([#7464](https://github.com/remix-run/remix/pull/7464))
- Fix resource routes being loaded through `route.lazy` ([#7498](https://github.com/remix-run/remix/pull/7498))
- Throw a semantically correct 405 `ErrorResponse` instead of just an `Error` when submitting to a route without an `action` ([#7423](https://github.com/remix-run/remix/pull/7423))
- Updated dependencies:
  - `@remix-run/server-runtime@2.0.1`

## 2.0.0

### Major Changes

- Drop React 17 support ([#7121](https://github.com/remix-run/remix/pull/7121))
- Require Node >=18.0.0 ([#6939](https://github.com/remix-run/remix/pull/6939))
- Remove `unstable_shouldReload`, which has been replaced by `shouldRevalidate` ([#6865](https://github.com/remix-run/remix/pull/6865))
- The route `meta` API now defaults to the new "V2 Meta" API ([#6958](https://github.com/remix-run/remix/pull/6958))
  - Please refer to the ([docs](https://remix.run/docs/en/2.0.0/route/meta) and [Preparing for V2](https://remix.run/docs/en/2.0.0/start/v2#route-meta) guide for more information.
- Promote the `future.v2_dev` flag in `remix.config.js` to a root level `dev` config ([#7002](https://github.com/remix-run/remix/pull/7002))
- Remove `v2_errorBoundary` flag and `CatchBoundary` implementation ([#6906](https://github.com/remix-run/remix/pull/6906))
- Remove back-compat layer for `useFetcher`/`useFetchers`, which includes a few small breaking changes ([#6874](https://github.com/remix-run/remix/pull/6874))
  - `fetcher.type` has been removed since it can be derived from other available information
  - "Submission" fields have been flattened from `fetcher.submission` down onto the root `fetcher` object, and prefixed with `form` in some cases (`fetcher.submission.action` => `fetcher.formAction`)
  - `<fetcher.Form method="get">` is now more accurately categorized as `state:"loading"` instead of `state:"submitting"` to better align with the underlying GET request
- Remove `v2_normalizeFormMethod` future flag - all `formMethod` values will be normalized in v2 ([#6875](https://github.com/remix-run/remix/pull/6875))
- Remove deprecated `useTransition` hook in favor of `useNavigation` - `useNavigation` is _almost_ identical with a few exceptions: ([#6870](https://github.com/remix-run/remix/pull/6870))
  - `useTransition.type` has been removed since it can be derived from other available information
  - "Submission" fields have been flattened from `useTransition().submission` down onto the root `useNavigation()` object
  - `<Form method="get">` is now more accurately categorized as `state:"loading"` instead of `state:"submitting"` to better align with the underlying GET navigation
- Remove `v2_routeConvention` flag - the flat route file convention is now standard. ([#6969](https://github.com/remix-run/remix/pull/6969))
- Remove `v2_headers` flag - it is now the default behavior to use the deepest `headers` function in the route tree. ([#6979](https://github.com/remix-run/remix/pull/6979))
- Removed/adjusted types to prefer `unknown` over `any` and to align with underlying React Router types ([#7319](https://github.com/remix-run/remix/pull/7319), [#7354](https://github.com/remix-run/remix/pull/7354)):
  - Renamed the `useMatches()` return type from `RouteMatch` to `UIMatch`
  - Renamed `LoaderArgs`/`ActionArgs` to `LoaderFunctionArgs`/`ActionFunctionArgs`
  - `AppData` changed from `any` to `unknown`
  - `Location["state"]` (`useLocation.state`) changed from `any` to `unknown`
  - `UIMatch["data"]` (`useMatches()[i].data`) changed from `any` to `unknown`
  - `UIMatch["handle"]` (`useMatches()[i].handle`) changed from `{ [k: string]: any }` to `unknown`
  - `Fetcher["data"]` (`useFetcher().data`) changed from `any` to `unknown`
  - `MetaMatch.handle` (used in `meta()`) changed from `any` to `unknown`
  - `AppData`/`RouteHandle` are no longer exported as they are just aliases for `unknown`
- Remove `imagesizes` & `imagesrcset` properties from `HtmlLinkDescriptor`, `LinkDescriptor` & `PrefetchPageDescriptor` types ([#6936](https://github.com/remix-run/remix/pull/6936))
- Remove deprecated `REMIX_DEV_SERVER_WS_PORT` env var ([#6965](https://github.com/remix-run/remix/pull/6965))
  - use `remix dev`'s '`--port`/`port` option instead
- Removed support for "magic exports" from the `remix` package. This package can be removed from your `package.json` and you should update all imports to use the source `@remix-run/*` packages: ([#6895](https://github.com/remix-run/remix/pull/6895))

  ```diff
  - import type { ActionArgs } from "remix";
  - import { json, useLoaderData } from "remix";
  + import type { ActionArgs } from "@remix-run/node";
  + import { json } from "@remix-run/node";
  + import { useLoaderData } from "@remix-run/react";
  ```

### Minor Changes

- Export the `Navigation` type returned from `useNavigation` ([#7136](https://github.com/remix-run/remix/pull/7136))
- Update Remix to use React Router `route.lazy` for module loading ([#7133](https://github.com/remix-run/remix/pull/7133))

### Patch Changes

- Add `error` to `meta()` params so you can render error titles, etc. ([#7105](https://github.com/remix-run/remix/pull/7105))

  ```tsx
  export function meta({ error }) {
    return [{ title: error.message }];
  }
  ```

- Re-Export `ShouldRevalidateFunctionArgs` type from React Router ([#7316](https://github.com/remix-run/remix/pull/7316))

- Deduplicate prefetch `link` tags ([#7060](https://github.com/remix-run/remix/pull/7060))

- Skip preloading of stylesheets on client-side route transitions if the browser does not support `<link rel=preload>` ([#7106](https://github.com/remix-run/remix/pull/7106))

  - This prevents us from hanging on client-side navigations when we try to preload stylesheets and never receive a `load`/`error` event on the `link` tag

- Export proper `ErrorResponse` type for usage alongside `isRouteErrorResponse` ([#7244](https://github.com/remix-run/remix/pull/7244))

- Use the hostname from `REMIX_DEV_ORIGIN` to connect to the live reload socket ([#6923](https://github.com/remix-run/remix/pull/6923))

- Use unique key for `script:ld+json` meta descriptors ([#6954](https://github.com/remix-run/remix/pull/6954))

- Fix live reload port when set explicitly as a prop ([#7358](https://github.com/remix-run/remix/pull/7358))

- Fix types for `useLoaderData` when using Yarn PnP ([#7137](https://github.com/remix-run/remix/pull/7137))

- Updated dependencies:
  - `@remix-run/server-runtime@2.0.0`
  - [`react-router-dom@6.16.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.16.0)
  - [`@remix-run/router@1.9.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#190)

## 1.19.3

No significant changes to this package were made in this release. [See the releases page on GitHub](https://github.com/remix-run/remix/releases/tag/remix%401.19.3) for an overview of all changes in v1.19.3.

## 1.19.2

No significant changes to this package were made in this release. [See the releases page on GitHub](https://github.com/remix-run/remix/releases/tag/remix%401.19.2) for an overview of all changes in v1.19.2.

## 1.19.1

No significant changes to this package were made in this release. [See the releases page on GitHub](https://github.com/remix-run/remix/releases/tag/remix%401.19.1) for an overview of all changes in v1.19.1.

## 1.19.0

### Minor Changes

- improved networking options for `v2_dev` ([#6724](https://github.com/remix-run/remix/pull/6724))

  deprecate the `--scheme` and `--host` options and replace them with the `REMIX_DEV_ORIGIN` environment variable

- Added some missing react-router exports to `@remix-run/react` ([#6856](https://github.com/remix-run/remix/pull/6856))

### Patch Changes

- Narrowed the type of `fetcher.formEncType` to use `FormEncType` from `react-router-dom` instead of `string` ([#6810](https://github.com/remix-run/remix/pull/6810))
- Deferred promises that return undefined/void now surface a serialization error. ([#6793](https://github.com/remix-run/remix/pull/6793))
- Properly handle `?_data` HTTP/Network errors that don't reach the Remix server and ensure they bubble to the `ErrorBoundary` ([#6783](https://github.com/remix-run/remix/pull/6783))
- Support proper hydration of `Error` subclasses such as `ReferenceError`/`TypeError` in development mode ([#6675](https://github.com/remix-run/remix/pull/6675))
- fix router race condition for hmr ([#6767](https://github.com/remix-run/remix/pull/6767))
- Avoid re-prefetching stylesheets for active routes during a revalidation ([#6679](https://github.com/remix-run/remix/pull/6679))
- Add generic type for `useRouteLoaderData()` ([#5157](https://github.com/remix-run/remix/pull/5157))
- Bump RR 6.14.2 ([#6854](https://github.com/remix-run/remix/pull/6854))
- Updated dependencies:
  - [`react-router-dom@6.14.2`](https://github.com/remix-run/react-router/releases/tag/react-router%406.14.2)
  - [`@remix-run/router@1.7.2`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#172)

## 1.18.1

### Patch Changes

- Fix reload loops in scenarios where CDNs ignore search params ([#6707](https://github.com/remix-run/remix/pull/6707))
- Updated dependencies:
  - [`react-router-dom@6.14.1`](https://github.com/remix-run/react-router/releases/tag/react-router%406.14.1)
  - [`@remix-run/router@1.7.1`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#171)

## 1.18.0

### Minor Changes

- stabilize v2 dev server ([#6615](https://github.com/remix-run/remix/pull/6615))
- Support `application/json` and `text/plain` submission encodings in `useSubmit`/`fetcher.submit` ([#6570](https://github.com/remix-run/remix/pull/6570))
- Add support for `<Link prefetch="viewport">` to prefetch links when they enter the viewport via an [Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver) ([#6433](https://github.com/remix-run/remix/pull/6433))

### Patch Changes

- Bump router 6.14.0-pre.1 ([#6662](https://github.com/remix-run/remix/pull/6662))
- Detect mismatches between the initially loaded URL and the URL at the time we hydrate and trigger a hard reload if they do not match. This is an edge-case that can happen when the network is slowish and the user clicks forward into a Remix app and then clicks forward again while the initial JS chunks are loading. ([#6409](https://github.com/remix-run/remix/pull/6409))
- Lock in react router 6.14.0 ([#6677](https://github.com/remix-run/remix/pull/6677))
- properly pass <Scripts /> props to inline script tags for deferred data ([#6389](https://github.com/remix-run/remix/pull/6389))

## 1.17.1

### Patch Changes

- Updated dependencies:
  - [`react-router-dom@6.13.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.13.0)

## 1.17.0

### Minor Changes

- Faster server export removal for routes when `unstable_dev` is enabled. ([#6455](https://github.com/remix-run/remix/pull/6455))

  Also, only render modulepreloads on SSR.
  Do not render modulepreloads when hydrated.

- Force Typescript to simplify type produced by `Serialize`. ([#6449](https://github.com/remix-run/remix/pull/6449))

  As a result, the following types and functions have simplified return types:

  - SerializeFrom
  - useLoaderData
  - useActionData
  - useFetcher

  ```ts
  type Data = { hello: string; when: Date };

  // BEFORE
  type Unsimplified = SerializeFrom<Data>;
  //   ^? SerializeObject<UndefinedToOptional<{ hello: string; when: Date }>>

  // AFTER
  type Simplified = SerializeFrom<Data>;
  //   ^? { hello: string; when: string }
  ```

- Reuse dev server port for WebSocket (Live Reload,HMR,HDR) ([#6476](https://github.com/remix-run/remix/pull/6476))

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

### Patch Changes

- retry HDR revalidations in development mode to aid in 3rd party server race conditions ([#6287](https://github.com/remix-run/remix/pull/6287))
- Updated dependencies:
  - [`react-router-dom@6.12.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.12.0)
  - [`@remix-run/router@1.6.3`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#163)

## 1.16.1

### Patch Changes

- Cross-module `loader` change detection for HDR ([#6299](https://github.com/remix-run/remix/pull/6299))
- Better opt-out of `loader` revalidation on UI only changes ([#6278](https://github.com/remix-run/remix/pull/6278))
- Add `useMatch` re-export from `react-router-dom` ([#5257](https://github.com/remix-run/remix/pull/5257))
- Fix `data` parameter typing on `V2_MetaFunction` to include `undefined` for scenarios in which the `loader` threw to it's own boundary. ([#6231](https://github.com/remix-run/remix/pull/6231))
- Updated dependencies:
  - [`react-router-dom@6.11.2`](https://github.com/remix-run/react-router/releases/tag/react-router%406.11.2)
  - [`@remix-run/router@1.6.2`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#162)

## 1.16.0

### Minor Changes

- Enable support for [CSS Modules](https://github.com/css-modules/css-modules), [Vanilla Extract](http://vanilla-extract.style) and CSS side-effect imports ([#6046](https://github.com/remix-run/remix/pull/6046))

  These CSS bundling features were previously only available via `future.unstable_cssModules`, `future.unstable_vanillaExtract` and `future.unstable_cssSideEffectImports` options in `remix.config.js`, but they have now been stabilized.

  In order to use these features, check out our guide to [CSS bundling](https://remix.run/docs/en/1.16.0/guides/styling#css-bundling) in your project.

- Stabilize built-in PostCSS support via the new `postcss` option in `remix.config.js`. As a result, the `future.unstable_postcss` option has also been deprecated. ([#5960](https://github.com/remix-run/remix/pull/5960))

  The `postcss` option is `false` by default, but when set to `true` will enable processing of all CSS files using PostCSS if `postcss.config.js` is present.

  If you followed the original PostCSS setup guide for Remix, you may have a folder structure that looks like this, separating your source files from its processed output:

      .
      ├── app
      │   └── styles (processed files)
      │       ├── app.css
      │       └── routes
      │           └── index.css
      └── styles (source files)
          ├── app.css
          └── routes
              └── index.css

  After you've enabled the new `postcss` option, you can delete the processed files from `app/styles` folder and move your source files from `styles` to `app/styles`:

      .
      ├── app
      │   └── styles (source files)
      │       ├── app.css
      │       └── routes
      │           └── index.css

  You should then remove `app/styles` from your `.gitignore` file since it now contains source files rather than processed output.

  You can then update your `package.json` scripts to remove any usage of `postcss` since Remix handles this automatically. For example, if you had followed the original setup guide:

  ```diff
  {
    "scripts": {
  -    "dev:css": "postcss styles --base styles --dir app/styles -w",
  -    "build:css": "postcss styles --base styles --dir app/styles --env production",
  -    "dev": "concurrently \"npm run dev:css\" \"remix dev\""
  +    "dev": "remix dev"
    }
  }
  ```

- Stabilize built-in Tailwind support via the new `tailwind` option in `remix.config.js`. As a result, the `future.unstable_tailwind` option has also been deprecated. ([#5960](https://github.com/remix-run/remix/pull/5960))

  The `tailwind` option is `false` by default, but when set to `true` will enable built-in support for Tailwind functions and directives in your CSS files if `tailwindcss` is installed.

  If you followed the original Tailwind setup guide for Remix and want to make use of this feature, you should first delete the generated `app/tailwind.css`.

  Then, if you have a `styles/tailwind.css` file, you should move it to `app/tailwind.css`.

  ```sh
  rm app/tailwind.css
  mv styles/tailwind.css app/tailwind.css
  ```

  Otherwise, if you don't already have an `app/tailwind.css` file, you should create one with the following contents:

  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```

  You should then remove `/app/tailwind.css` from your `.gitignore` file since it now contains source code rather than processed output.

  You can then update your `package.json` scripts to remove any usage of `tailwindcss` since Remix handles this automatically. For example, if you had followed the original setup guide:

  ```diff
  {
    // ...
    "scripts": {
  -    "build": "run-s \"build:*\"",
  +    "build": "remix build",
  -    "build:css": "npm run generate:css -- --minify",
  -    "build:remix": "remix build",
  -    "dev": "run-p \"dev:*\"",
  +    "dev": "remix dev",
  -    "dev:css": "npm run generate:css -- --watch",
  -    "dev:remix": "remix dev",
  -    "generate:css": "npx tailwindcss -o ./app/tailwind.css",
      "start": "remix-serve build"
    }
    // ...
  }
  ```

### Patch Changes

- fix(react,dev): dev chunking and refresh race condition ([#6201](https://github.com/remix-run/remix/pull/6201))
- Revalidate loaders only when a change to one is detected. ([#6135](https://github.com/remix-run/remix/pull/6135))
- short circuit links and meta for routes that are not rendered due to errors ([#6107](https://github.com/remix-run/remix/pull/6107))
- don't warn about runtime deprecation warnings in production ([#4421](https://github.com/remix-run/remix/pull/4421))
- Update Remix for React Router no longer relying on `useSyncExternalStore` ([#6121](https://github.com/remix-run/remix/pull/6121))
- Fix false-positive resource route identification if a route only exports a boundary ([#6125](https://github.com/remix-run/remix/pull/6125))
- better type discrimination when unwrapping loader return types ([#5516](https://github.com/remix-run/remix/pull/5516))
- Updated dependencies:
  - [`react-router-dom@6.11.0`](https://github.com/remix-run/react-router/releases/tag/react-router%406.11.0)
  - [`@remix-run/router@1.6.0`](https://github.com/remix-run/react-router/blob/main/packages/router/CHANGELOG.md#160)

## 1.15.0

### Minor Changes

- Deprecated `fetcher.type` and `fetcher.submission` for Remix v2 ([#5691](https://github.com/remix-run/remix/pull/5691))

- We have made a few changes to the API for route module `meta` functions when using the `future.v2_meta` flag. **These changes are _only_ breaking for users who have opted in.** ([#5746](https://github.com/remix-run/remix/pull/5746))

  - `V2_HtmlMetaDescriptor` has been renamed to `V2_MetaDescriptor`
  - The `meta` function's arguments have been simplified
    - `parentsData` has been removed, as each route's loader data is available on the `data` property of its respective `match` object
      ```tsx
      // before
      export function meta({ parentsData }) {
        return [{ title: parentsData["routes/some-route"].title }];
      }
      // after
      export function meta({ matches }) {
        return [
          {
            title: matches.find((match) => match.id === "routes/some-route")
              .data.title,
          },
        ];
      }
      ```
    - The `route` property on route matches has been removed, as relevant match data is attached directly to the match object
      ```tsx
      // before
      export function meta({ matches }) {
        const rootModule = matches.find((match) => match.route.id === "root");
      }
      // after
      export function meta({ matches }) {
        const rootModule = matches.find((match) => match.id === "root");
      }
      ```
  - Added support for generating `<script type='application/ld+json' />` and meta-related `<link />` tags to document head via the route `meta` function when using the `v2_meta` future flag

- Added deprecation warning for `v2_normalizeFormMethod` ([#5863](https://github.com/remix-run/remix/pull/5863))

- Added a new `future.v2_normalizeFormMethod` flag to normalize the exposed `useNavigation().formMethod` as an uppercase HTTP method to align with the previous `useTransition` behavior as well as the `fetch()` behavior of normalizing to uppercase HTTP methods. ([#5815](https://github.com/remix-run/remix/pull/5815))

  - When `future.v2_normalizeFormMethod === false`,
    - `useNavigation().formMethod` is lowercase
    - `useFetcher().formMethod` is uppercase
  - When `future.v2_normalizeFormMethod === true`:
    - `useNavigation().formMethod` is uppercase
    - `useFetcher().formMethod` is uppercase

- Added deprecation warning for normalizing `imagesizes` & `imagesrcset` properties returned from the route `links` function. Both properties should be in camelCase (`imageSizes`/ `imageSrcSet`) to align with their respective JavaScript properties. ([#5706](https://github.com/remix-run/remix/pull/5706))

- Added deprecation warning for `CatchBoundary` in favor of `future.v2_errorBoundary` ([#5718](https://github.com/remix-run/remix/pull/5718))

- Added experimental support for Vanilla Extract caching, which can be enabled by setting `future.unstable_vanillaExtract: { cache: true }` in `remix.config`. This is considered experimental due to the use of a brand new Vanilla Extract compiler under the hood. In order to use this feature, you must be using at least `v1.10.0` of `@vanilla-extract/css`. ([#5735](https://github.com/remix-run/remix/pull/5735))

### Patch Changes

- Bumped React Router dependencies to the latest version. [See the release notes for more details.](https://github.com/remix-run/react-router/releases/tag/react-router%406.10.0) ([`e14699547`](https://github.com/remix-run/remix/commit/e1469954737a2e45636b6aef73dc9ae251fb1b20))
- Added type deprecations for types now in React Router ([#5679](https://github.com/remix-run/remix/pull/5679))

## 1.14.3

No significant changes to this package were made in this release. [See the releases page on GitHub](https://github.com/remix-run/remix/releases/tag/remix%401.14.2) for an overview of all changes in v1.14.3.

## 1.14.2

No significant changes to this package were made in this release. [See the releases page on GitHub](https://github.com/remix-run/remix/releases/tag/remix%401.14.2) for an overview of all changes in v1.14.2.

## 1.14.1

### Patch Changes

- Deprecate `useTransition` in favor of `useNavigation` ([#5687](https://github.com/remix-run/remix/pull/5687))
- Memoize return value of `useMatches` ([#5603](https://github.com/remix-run/remix/pull/5603))

## 1.14.0

### Minor Changes

- Hot Module Replacement and Hot Data Revalidation ([#5259](https://github.com/remix-run/remix/pull/5259))
  - Requires `unstable_dev` future flag to be enabled
  - HMR provided through React Refresh
  - Features:
    - HMR for component and style changes
    - HDR when loaders for current route change
  - Known limitations for MVP:
    - Only implemented for React via React Refresh
    - No `import.meta.hot` API exposed yet
    - Revalidates _all_ loaders on route when loader changes are detected
    - Loader changes do not account for imported dependencies changing

### Patch Changes

- Remove duplicate manifest imports ([#5534](https://github.com/remix-run/remix/pull/5534))
- Ensure types for fetchers always include `form*` submission fields ([#5476](https://github.com/remix-run/remix/pull/5476))
- Sync `FutureConfig` interface between packages ([#5398](https://github.com/remix-run/remix/pull/5398))
- Updated dependencies:
  - `@remix-run/router@1.3.3`
  - `react-router-dom@8.6.2`

## 1.13.0

### Minor Changes

- Add built-in support for PostCSS via the `future.unstable_postcss` feature flag ([#5229](https://github.com/remix-run/remix/pull/5229))
- Add built-in support for Tailwind via the `future.unstable_tailwind` feature flag ([#5229](https://github.com/remix-run/remix/pull/5229))

### Patch Changes

- Bump React Router dependencies to the latest version. [See the release notes for more details.](https://github.com/remix-run/react-router/releases/tag/react-router%406.8.1) ([#5389](https://github.com/remix-run/remix/pull/5389))
- Improve efficiency of route manifest-to-tree transformation ([#4748](https://github.com/remix-run/remix/pull/4748))
- Added better detection for absolute urls in `<Link>` and `<NavLink>` components ([#5390](https://github.com/remix-run/remix/pull/5390))

## 1.12.0

### Minor Changes

- Added a new development server available in the Remix config under the `unstable_dev` flag. [See the release notes](https://github.com/remix-run/remix/releases/tag/remix%401.12.0) for a full description. ([#5133](https://github.com/remix-run/remix/pull/5133))
- You can now configure the client-side socket timeout via the new `timeoutMs` prop on `<LiveReload />` ([#4036](https://github.com/remix-run/remix/pull/4036))

### Patch Changes

- `<Link to>` can now accept absolute URLs. When the `to` value is an absolute URL, the underlying anchor element will behave as normal, and its URL will not be prefetched. ([#5092](https://github.com/remix-run/remix/pull/5092))
- Bump React Router dependencies to the latest version. [See the release notes for more details.](https://github.com/remix-run/react-router/releases/tag/react-router%406.8.0) ([#5242](https://github.com/remix-run/remix/pull/5242))
- Added support for `unstable_useBlocker` and `unstable_usePrompt` from React Router ([#5151](https://github.com/remix-run/remix/pull/5151))

## 1.11.1

No significant changes to this package were made in this release. [See the releases page on GitHub](https://github.com/remix-run/remix/releases/tag/remix%401.11.1) for an overview of all changes in v1.11.1.

## 1.11.0

### Minor Changes

- Added support for [Vanilla Extract](https://vanilla-extract.style) via the `unstable_vanillaExtract` future flag. **IMPORTANT:** Features marked with `unstable` are … unstable. While we're confident in the use cases they solve, the API and implementation may change without a major version bump. ([#5040](https://github.com/remix-run/remix/pull/5040))
- Add support for CSS side-effect imports via the `unstable_cssSideEffectImports` future flag. **IMPORTANT:** Features marked with `unstable` are … unstable. While we're confident in the use cases they solve, the API and implementation may change without a major version bump. ([#4919](https://github.com/remix-run/remix/pull/4919))
- Add support for CSS Modules via the `unstable_cssModules` future flag. **IMPORTANT:** Features marked with `unstable` are … unstable. While we're confident in the use cases they solve, the API and implementation may change without a major version bump. ([#4852](https://github.com/remix-run/remix/pull/4852))

### Patch Changes

- Fix v2 `meta` to ensure meta is rendered from the next route in the tree if no `meta` export is included in a leaf route ([#5041](https://github.com/remix-run/remix/pull/5041))

- Ensure `useFetcher` is stable across re-renders in backwards-compatibility layer ([#5118](https://github.com/remix-run/remix/pull/5118))

- Added the `v2_errorBoundary` future flag to opt into the next version of Remix's `ErrorBoundary` behavior. This removes the separate `CatchBoundary` and `ErrorBoundary` and consolidates them into a single `ErrorBoundary`, following the logic used by `errorElement` in React Router. You can then use `isRouteErrorResponse` to differentiate between thrown `Response`/`Error` instances. ([#4918](https://github.com/remix-run/remix/pull/4918))

  ```tsx
  // Current (Remix v1 default)
  import { useCatch } from "@remix-run/react";

  export function CatchBoundary() {
    const caught = useCatch();
    return (
      <p>
        {caught.status} {caught.data}
      </p>
    );
  }

  export function ErrorBoundary({ error }) {
    return <p>{error.message}</p>;
  }
  ```

  ```tsx
  // Using future.v2_errorBoundary
  import { isRouteErrorResponse, useRouteError } from "@remix-run/react";

  export function ErrorBoundary() {
    const error = useRouteError();

    return isRouteErrorResponse(error) ? (
      <p>
        {error.status} {error.data}
      </p>
    ) : (
      <p>{error.message}</p>
    );
  }
  ```

- Introduces the `defer()` API from `@remix-run/router` with support for server-rendering and HTTP streaming. This utility allows you to defer values returned from `loader` functions by returning promises instead of resolved values. This has been refered to as _"sending a promise over the wire"_. ([#4920](https://github.com/remix-run/remix/pull/4920))

  Informational Resources:

  - <https://gist.github.com/jacob-ebey/9bde9546c1aafaa6bc8c242054b1be26>
  - <https://github.com/remix-run/remix/blob/main/decisions/0004-streaming-apis.md>

  Documentation Resources (better docs specific to Remix are in the works):

  - <https://reactrouter.com/en/main/utils/defer>
  - <https://reactrouter.com/en/main/components/await>
  - <https://reactrouter.com/en/main/hooks/use-async-value>
  - <https://reactrouter.com/en/main/hooks/use-async-error>

## 1.10.1

### Patch Changes

- Fetchers should persist data through reload/resubmit ([#5065](https://github.com/remix-run/remix/pull/5065))
- Update babel config to transpile down to node 14 ([#5047](https://github.com/remix-run/remix/pull/5047))

## 1.10.0

### Minor Changes

- Update Remix to use new data APIs introduced in React Router v6.4 ([#4900](https://github.com/remix-run/remix/pull/4900))
- Added new hooks from React Router
  - [`useNavigation`](https://reactrouter.com/en/main/hooks/use-navigation)
  - [`useNavigationType`](https://reactrouter.com/en/main/hooks/use-navigation-type)
  - [`useRevalidator`](https://reactrouter.com/en/main/hooks/use-revalidator)
  - [`useRouteLoaderData`](https://reactrouter.com/en/main/hooks/use-route-loader-data)

## 1.9.0

### Patch Changes

- Update `@remix-run/react` to use `Router` from `react-router-dom@6.5.0` ([#4731](https://github.com/remix-run/remix/pull/4731))
- Allow pass-through props to be passed to the script rendered by `ScrollRestoration` ([#2879](https://github.com/remix-run/remix/pull/2879))
- Fixed a problem with `<LiveReload>` and Firefox infinitely reloading the page. ([#4725](https://github.com/remix-run/remix/pull/4725))

## 1.8.2

No significant changes to this package were made in this release. [See the releases page on GitHub](https://github.com/remix-run/remix/releases/tag/remix%401.8.2) for an overview of all changes in v1.8.2.

## 1.8.1

No significant changes to this package were made in this release. [See the releases page on GitHub](https://github.com/remix-run/remix/releases/tag/remix%401.8.1) for an overview of all changes in v1.8.1.

## 1.8.0

### Minor Changes

- Importing functions and types from the `remix` package is deprecated, and all ([#3284](https://github.com/remix-run/remix/pull/3284))
  exported modules will be removed in the next major release. For more details,
  [see the release notes for 1.4.0](https://github.com/remix-run/remix/releases/tag/v1.4.0)
  where these changes were first announced.
- Added support for a new route `meta` API to handle arrays of tags instead of an object. For details, check out the [RFC](https://github.com/remix-run/remix/discussions/4462). ([#4610](https://github.com/remix-run/remix/pull/4610))

### Patch Changes

- Ensure route modules are loaded even in failure cases. This addresses a long standing issue where you would end up in your root catch boundary if a form transition to another route threw. This no longer occurs, and you end up in the contextual boundary you'd expect. ([#4611](https://github.com/remix-run/remix/pull/4611))

## 1.7.6

### Patch Changes

- Fixed a regression in the browser build for browsers that don't support the nullish coalescing operator ([#4561](https://github.com/remix-run/remix/pull/4561))

## 1.7.5

### Patch Changes

- Make sure namespaced Open Graph and `fb:app_id` meta data renders the correct attributes on `<meta>` tags ([#4445](https://github.com/remix-run/remix/pull/4445))

## 1.7.4

### Patch Changes

- Ignore pathless layout routes in action matches ([#4376](https://github.com/remix-run/remix/pull/4376))
- You can now infer the type of the `.data` property of `useFetcher` from the return type of your `loader` and `action` functions ([#4392](https://github.com/remix-run/remix/pull/4392))
- Fixed a bug in `<Form>` that prevented the correct method from being called with non-`POST` submissions ([`b52507861`](https://github.com/remix-run/remix/commit/b5250786164c2632bb239553f33896805103809a))

## 1.7.3

### Patch Changes

- Ensure that `<Form />` respects the `formMethod` attribute set on the submitter element ([#4053](https://github.com/remix-run/remix/pull/4053))

## 1.7.2

### Patch Changes

- Remove unused `type-fest` dependency ([#4246](https://github.com/remix-run/remix/pull/4246))
- Preserve `?index` for fetcher get submissions to index routes ([#4238](https://github.com/remix-run/remix/pull/4238))

## 1.7.1

### Patch Changes

- Properly locked the dependency on `react-router-dom` to version 6.3.0 ([#4203](https://github.com/remix-run/remix/pull/4203))
- Fixed a bug with `GET` form submissions to ensure they replace the current search params, which tracks with the browser's behavior ([#4046](https://github.com/remix-run/remix/pull/4046))

## 1.7.0

### Minor Changes

- We've added a new type: `SerializeFrom`. This is used to infer the ([#4013](https://github.com/remix-run/remix/pull/4013))
  JSON-serialized return type of loaders and actions.

### Patch Changes

- Unblock hydration via async module scripts. ([#3918](https://github.com/remix-run/remix/pull/3918))

## 1.6.8

### Patch Changes

- Previously, if an `action` was omitted from `<Form>` or `useFormAction`, the action value would default to `"."`. This is incorrect, as `"."` should resolve based on the current _path_, but an empty action resolves relative to the current _URL_ (including the search and hash values). We've fixed this to differentiate between the two, meaning that the resolved action will preserve the full URL. ([#3697](https://github.com/remix-run/remix/pull/3697))
- Enhanced some types to work more seamlessly with React 18 ([#3917](https://github.com/remix-run/remix/pull/3917))
- Added a subscribe method to the transition manager, which allows subscribing and unsubscribing for React 18 strict mode compliance ([#3964](https://github.com/remix-run/remix/pull/3964))

## 1.6.7

### Patch Changes

- Fix inferred types for `useLoaderData` and `useActionData` to preserve `null` value types ([#3879](https://github.com/remix-run/remix/pull/3879))

## 1.6.6

### Patch Changes

- Allow the `ReadonlyArray` type in `SerializeType` for action and loader data ([#3774](https://github.com/remix-run/remix/pull/3774))
- Support undefined unions as optional keys in types returned from `useLoaderData` and `useActionData` ([#3766](https://github.com/remix-run/remix/pull/3766))

## 1.6.5

### Patch Changes

- We enhanced the type signatures of `loader`/`action` and
  `useLoaderData`/`useActionData` to make it possible to infer the data type
  from return type of its related server function.

  To enable this feature, you will need to use the `LoaderArgs` type from your
  Remix runtime package instead of typing the function directly:

  ```diff
  - import type { LoaderFunction } from "@remix-run/[runtime]";
  + import type { LoaderArgs } from "@remix-run/[runtime]";

  - export const loader: LoaderFunction = async (args) => {
  -   return json<LoaderData>(data);
  - }
  + export async function loader(args: LoaderArgs) {
  +   return json(data);
  + }
  ```

  Then you can infer the loader data by using `typeof loader` as the type
  variable in `useLoaderData`:

  ```diff
  - let data = useLoaderData() as LoaderData;
  + let data = useLoaderData<typeof loader>();
  ```

  The API above is exactly the same for your route `action` and `useActionData`
  via the `ActionArgs` type.

  With this change you no longer need to manually define a `LoaderData` type
  (huge time and typo saver!), and we serialize all values so that
  `useLoaderData` can't return types that are impossible over the network, such
  as `Date` objects or functions.

  See the discussions in [#1254](https://github.com/remix-run/remix/pull/1254)
  and [#3276](https://github.com/remix-run/remix/pull/3276) for more context.

- Add `WebSocket` reconnect to `LiveReload`
