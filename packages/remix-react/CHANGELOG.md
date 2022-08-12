# `@remix-run/react`

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
