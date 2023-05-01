# `@remix-run/react`

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
