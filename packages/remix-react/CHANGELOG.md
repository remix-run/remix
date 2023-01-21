# `@remix-run/react`

## 1.11.1

## 1.11.0

### Minor Changes

- Added support for [Vanilla Extract](https://vanilla-extract.style) via the `unstable_vanillaExtract` future flag. **IMPORTANT:** Features marked with `unstable` are … unstable. While we're confident in the use cases they solve, the API and implementation may change without a major version bump. ([#5040](https://github.com/remix-run/remix/pull/5040))
- Add support for CSS side-effect imports via the `unstable_cssSideEffectImports` future flag. **IMPORTANT:** Features marked with `unstable` are … unstable. While we're confident in the use cases they solve, the API and implementation may change without a major version bump. ([#4919](https://github.com/remix-run/remix/pull/4919))
- Add support for CSS Modules via the `unstable_cssModules` future flag. **IMPORTANT:** Features marked with `unstable` are … unstable. While we're confident in the use cases they solve, the API and implementation may change without a major version bump. ([#4852](https://github.com/remix-run/remix/pull/4852))

### Patch Changes

- Fix v2 `meta` to ensure meta is rendered from the next route in the tree if no `meta` export is included in a leaf route ([#5041](https://github.com/remix-run/remix/pull/5041))

- Ensure `useFetcher` is stable across re-renders in backwards-compatibility layer ([#5118](https://github.com/remix-run/remix/pull/5118))

- Added the `v2_errorBoundary` future flag to opt into the next version of Remix's `ErrorBoundary` behavior. This removes the separate `CatchBoundary` and `ErrorBoundary` and consolidates them into a single `ErrorBoundary`, following the logic used by `errorElement` in React Router. You can then use `isRouteErrorResponse` to differentiate between thrown `Response`/`Error` instances. ([#4918](https://github.com/remix-run/remix/pull/4918))

  ```jsx
  // Current (Remix v1 default)
  import { useCatch } from "@remix-run/react";

  export function CatchBoundary() {
    let caught = useCatch();
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

  ```jsx
  // Using future.v2_errorBoundary
  import { isRouteErrorResponse, useRouteError } from "@remix-run/react";

  export function ErrorBoundary() {
    let error = useRouteError();

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
