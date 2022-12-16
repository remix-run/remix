# `remix`

## 1.9.0-pre.1

### Patch Changes

- Update react-router ([`31bb30741`](https://github.com/remix-run/remix/commit/31bb307419f733d9cfd2c16e74890a075eac7682))

## 1.9.0-pre.0

### Patch Changes

- Support Typescript 4.9 features (like `satisfies`) in Remix `app/` code ([#4754](https://github.com/remix-run/remix/pull/4754))

  esbuild 0.15.13 added support for parsing TS 4.9 `satisfies`, so upgrading to esbuild 0.16.3 adds that ability to the Remix compiler

- Fix `TypedResponse` so that Typescript correctly shows errors for incompatible types in loaders and actions. ([#4734](https://github.com/remix-run/remix/pull/4734))

  Previously, when the return type of a loader or action was explicitly set to `TypedResponse<SomeType>`,
  Typescript would not show errors when the loader or action returned an incompatible type.

  For example:

  ```ts
  export const action = async (
    args: ActionArgs
  ): Promise<TypedResponse<string>> => {
    return json(42);
  };
  ```

  In this case, Typescript would not show an error even though `42` is clearly not a `string`.

  This happens because `json` returns a `TypedResponse<string>`,
  but because `TypedReponse<string>` was previously just `Response & { json: () => Promise<string> }`
  and `Response` already defines `{ json: () => Promise<any> }`, type erasure caused `Promise<any>` to be used for `42`.

  To fix this, we explicitly omit the `Response`'s `json` property before intersecting with `{ json: () => Promise<T> }`.

- Optimize `parentRouteId` lookup in `defineConventionalRoutes` ([#4800](https://github.com/remix-run/remix/pull/4800))

  Local runs of production Remix builds:

  - Realistic project w/ 700 routes: 10-15s -> <1s (>10x faster)
  - Example project w/ 1,111 routes: 27s -> 0.104s (259x faster)

- adds a new testing package to allow easier testing of components using Remix specific apis like useFetcher, useActionData, etc. ([#4539](https://github.com/remix-run/remix/pull/4539))
- fixes a bug in ts -> js conversion on windows by using a relative unix style path as fast-glob uses unix style paths ([#4718](https://github.com/remix-run/remix/pull/4718))

See the `CHANGELOG.md` in individual Remix packages for all changes.
