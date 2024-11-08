# @remix-run/deno

## 2.14.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.14.0`

## 2.13.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.13.1`

## 2.13.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.13.0`

## 2.12.1

### Patch Changes

- Single Fetch: Re-export `interface Future` through
  `@remix-run/node`/`@remix-run/cloudflare`/`@remix-run/deno` packages so that
  `pnpm` doesn't complain about `@remix-run/server-runtime` not being a
  dependency ([#9982](https://github.com/remix-run/remix/pull/9982))
- Updated dependencies:
  - `@remix-run/server-runtime@2.12.1`

## 2.12.0

### Patch Changes

- Single Fetch: Improved typesafety
  ([#9893](https://github.com/remix-run/remix/pull/9893))

  If you were already using previously released unstable single-fetch types:

  - Remove `"@remix-run/react/future/single-fetch.d.ts"` override from
    `tsconfig.json` > `compilerOptions` > `types`
  - Remove `defineLoader`, `defineAction`, `defineClientLoader`,
    `defineClientAction` helpers from your route modules
  - Replace `UIMatch_SingleFetch` type helper with `UIMatch`
  - Replace `MetaArgs_SingleFetch` type helper with `MetaArgs`

  Then you are ready for the new typesafety setup:

  ```ts
  // vite.config.ts

  declare module "@remix-run/server-runtime" {
    interface Future {
      unstable_singleFetch: true; // 👈 enable _types_ for single-fetch
    }
  }

  export default defineConfig({
    plugins: [
      remix({
        future: {
          unstable_singleFetch: true, // 👈 enable single-fetch
        },
      }),
    ],
  });
  ```

  For more information, see
  [Guides > Single Fetch](https://remix.run/docs/en/dev/guides/single-fetch) in
  our docs.

- Updated dependencies:
  - `@remix-run/server-runtime@2.12.0`

## 2.11.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.11.2`

## 2.11.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.11.1`

## 2.11.0

### Minor Changes

- Single Fetch: Add a new `unstable_data()` API as a replacement for
  `json`/`defer` when custom `status`/`headers` are needed
  ([#9769](https://github.com/remix-run/remix/pull/9769))
- Add a new `replace(url, init?)` alternative to `redirect(url, init?)` that
  performs a `history.replaceState` instead of a `history.pushState` on
  client-side navigation redirects
  ([#9764](https://github.com/remix-run/remix/pull/9764))

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.11.0`

## 2.10.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.10.3`

## 2.10.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.10.2`

## 2.10.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.10.1`

## 2.10.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.10.0`

## 2.9.2

### Patch Changes

- Typesafety for single-fetch: `defineLoader`, `defineClientLoader`,
  `defineAction`, `defineClientAction`
  ([#9372](https://github.com/remix-run/remix/pull/9372),
  [#9404](https://github.com/remix-run/remix/pull/9404))
- Updated dependencies:
  - `@remix-run/server-runtime@2.9.2`

## 2.9.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.9.1`

## 2.9.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.9.0`

## 2.8.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.8.1`

## 2.8.0

### Patch Changes

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

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.7.0`

## 2.6.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.6.0`

## 2.5.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.5.1`

## 2.5.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.5.0`

## 2.4.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.4.1`

## 2.4.0

### Minor Changes

- Deprecate `DataFunctionArgs` in favor of
  `LoaderFunctionArgs`/`ActionFunctionArgs`
  ([#8173](https://github.com/remix-run/remix/pull/8173))
  - This is aimed at keeping the types aligned across server/client
    loaders/actions now that `clientLoader`/`clientActon` functions have
    `serverLoader`/`serverAction` parameters which differentiate
    `ClientLoaderFunctionArgs`/`ClientActionFunctionArgs`

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.4.0`

## 2.3.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.3.1`

## 2.3.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.3.0`

## 2.2.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.2.0`

## 2.1.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.1.0`

## 2.0.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@2.0.1`

## 2.0.0

### Major Changes

- Removed/adjusted types to prefer `unknown` over `any` and to align with
  underlying React Router types
  ([#7319](https://github.com/remix-run/remix/pull/7319),
  [#7354](https://github.com/remix-run/remix/pull/7354)):
  - Renamed the `useMatches()` return type from `RouteMatch` to `UIMatch`
  - Renamed `LoaderArgs`/`ActionArgs` to
    `LoaderFunctionArgs`/`ActionFunctionArgs`
  - `AppData` changed from `any` to `unknown`
  - `Location["state"]` (`useLocation.state`) changed from `any` to `unknown`
  - `UIMatch["data"]` (`useMatches()[i].data`) changed from `any` to `unknown`
  - `UIMatch["handle"]` (`useMatches()[i].handle`) changed from
    `{ [k: string]: any }` to `unknown`
  - `Fetcher["data"]` (`useFetcher().data`) changed from `any` to `unknown`
  - `MetaMatch.handle` (used in `meta()`) changed from `any` to `unknown`
  - `AppData`/`RouteHandle` are no longer exported as they are just aliases for
    `unknown`
- Require Node >=18.0.0 ([#6939](https://github.com/remix-run/remix/pull/6939))
- The route `meta` API now defaults to the new "V2 Meta" API
  ([#6958](https://github.com/remix-run/remix/pull/6958))
  - Please refer to the ([docs](https://remix.run/docs/en/2.0.0/route/meta) and
    [Preparing for V2](https://remix.run/docs/en/2.0.0/start/v2#route-meta)
    guide for more information.

### Minor Changes

- Re-export the new `redirectDocument` method from React Router
  ([#7040](https://github.com/remix-run/remix/pull/7040),
  [#6842](https://github.com/remix-run/remix/pull/6842))
  ([#7040](https://github.com/remix-run/remix/pull/7040))

### Patch Changes

- Export proper `ErrorResponse` type for usage alongside `isRouteErrorResponse`
  ([#7244](https://github.com/remix-run/remix/pull/7244))
- Updated dependencies:
  - `@remix-run/server-runtime@2.0.0`

## 1.19.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.19.3`

## 1.19.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.19.2`

## 1.19.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.19.1`

## 1.19.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.19.0`

## 1.18.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.18.1`

## 1.18.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.18.0`

## 1.17.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.17.1`

## 1.17.0

### Patch Changes

- Add `HeadersArgs` type to be consistent with loaders/actions/meta and allows
  for using a `function` declaration in addition to an arrow function expression
  ([#6247](https://github.com/remix-run/remix/pull/6247))

  ```tsx
  import type { HeadersArgs } from "@remix-run/node"; // or cloudflare/deno

  export function headers({ loaderHeaders }: HeadersArgs) {
    return {
      "x-my-custom-thing": loaderHeaders.get("x-my-custom-thing") || "fallback",
    };
  }
  ```

- Updated dependencies:
  - `@remix-run/server-runtime@1.17.0`

## 1.16.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.16.1`

## 1.16.0

### Patch Changes

- add `logDevReady` as replacement for platforms that can't initialize async I/O
  outside of the request response lifecycle.
  ([#6204](https://github.com/remix-run/remix/pull/6204))
- Updated dependencies:
  - `@remix-run/server-runtime@1.16.0`

## 1.15.0

### Minor Changes

- We have made a few changes to the API for route module `meta` functions when
  using the `future.v2_meta` flag. **These changes are _only_ breaking for users
  who have opted in.** ([#5746](https://github.com/remix-run/remix/pull/5746))

  - `V2_HtmlMetaDescriptor` has been renamed to `V2_MetaDescriptor`
  - The `meta` function's arguments have been simplified
    - `parentsData` has been removed, as each route's loader data is available
      on the `data` property of its respective `match` object
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
    - The `route` property on route matches has been removed, as relevant match
      data is attached directly to the match object
      ```tsx
      // before
      export function meta({ matches }) {
        let rootModule = matches.find((match) => match.route.id === "root");
      }
      // after
      export function meta({ matches }) {
        let rootModule = matches.find((match) => match.id === "root");
      }
      ```
  - Added support for generating `<script type='application/ld+json' />` and
    meta-related `<link />` tags to document head via the route `meta` function
    when using the `v2_meta` future flag

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.15.0`

## 1.14.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.14.3`

## 1.14.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.14.2`

## 1.14.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.14.1`

## 1.14.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.14.0`

## 1.13.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.13.0`

## 1.12.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.12.0`

## 1.11.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.11.1`

## 1.11.0

### Patch Changes

- Introduces the `defer()` API from `@remix-run/router` with support for
  server-rendering and HTTP streaming. This utility allows you to defer values
  returned from `loader` functions by returning promises instead of resolved
  values. This has been refered to as _"sending a promise over the wire"_.
  ([#4920](https://github.com/remix-run/remix/pull/4920))

  Informational Resources:

  - <https://gist.github.com/jacob-ebey/9bde9546c1aafaa6bc8c242054b1be26>
  - <https://github.com/remix-run/remix/blob/main/decisions/0004-streaming-apis.md>

  Documentation Resources (better docs specific to Remix are in the works):

  - <https://reactrouter.com/v6/utils/defer>
  - <https://reactrouter.com/v6/components/await>
  - <https://reactrouter.com/v6/hooks/use-async-value>
  - <https://reactrouter.com/v6/hooks/use-async-error>

- Updated dependencies:
  - `@remix-run/server-runtime@1.11.0`

## 1.10.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.10.1`

## 1.10.0

### Patch Changes

- Export `V2_HtmlMetaDescriptor` and `V2_MetaFunction` types from runtime
  packages ([#4943](https://github.com/remix-run/remix/pull/4943))
- Updated dependencies:
  - `@remix-run/server-runtime@1.10.0`

## 1.9.0

### Patch Changes

- Fixed type issues for the request handler context
  ([#4715](https://github.com/remix-run/remix/pull/4715))
- Updated dependencies:
  - `@remix-run/server-runtime@1.9.0`

## 1.8.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.8.2`

## 1.8.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.8.1`

## 1.8.0

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.8.0`

## 1.7.6

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.7.6`

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.7.6-pre.0`

## 1.7.5

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.7.5`

## 1.7.4

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.7.4`

## 1.7.3

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.7.3`

## 1.7.2

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.7.2`

## 1.7.1

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.7.1`

## 1.7.0

### Minor Changes

- We've added a new type: `SerializeFrom`. This is used to infer the
  ([#4013](https://github.com/remix-run/remix/pull/4013)) JSON-serialized return
  type of loaders and actions.

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.7.0`

## 1.6.8

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.6.8`

## 1.6.7

### Patch Changes

- Updated dependencies:
  - `@remix-run/server-runtime@1.6.7`

## 1.6.6

### Patch Changes

- Add `index.ts` to `main` field to fix Node resolution issues when running
  `remix dev` or `remix watch`
  ([#3868](https://github.com/remix-run/remix/pull/3868))
- Updated dependencies:
  - `@remix-run/server-runtime@1.6.6`

## 1.6.5

### Patch Changes

- We enhanced the type signatures of `loader`/`action` and
  `useLoaderData`/`useActionData` to make it possible to infer the data type
  from return type of its related server function.
  ([#1254](https://github.com/remix-run/remix/pull/1254))
- Updated dependencies
  - `@remix-run/server-runtime@1.6.5`
