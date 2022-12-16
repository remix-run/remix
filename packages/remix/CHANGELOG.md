# `remix`

## 1.9.0

### Patch Changes

- The Remix compiler now supports new Typescript 4.9 syntax (like the `satisfies` keyword) ([#4754](https://github.com/remix-run/remix/pull/4754))
- Fix `TypedResponse` so that Typescript correctly shows errors for incompatible types in `loader` and `action` functions. ([#4734](https://github.com/remix-run/remix/pull/4734))

  Previously, when the return type of a `loader` or `action` was explicitly set to `TypedResponse<SomeType>`,
  Typescript would not show errors when the function returned an incompatible type.

  For example:

  ```ts
  export const action = async (
    args: ActionArgs
  ): Promise<TypedResponse<string>> => {
    return json(42);
  };
  ```

  In this case, Typescript would not show an error even though `42` is clearly not a `string`.

  This happens because `json` returns a `TypedResponse<string>`, but because `TypedReponse<string>` was previously just `Response & { json: () => Promise<string> }` and `Response` already defines `{ json: () => Promise<any> }`, type erasure caused `Promise<any>` to be used for `42`.

  To fix this, we explicitly omit the `Response` object's `json` property before intersecting with `{ json: () => Promise<T> }`.

- Optimize `parentRouteId` lookup in `defineConventionalRoutes`. ([#4800](https://github.com/remix-run/remix/pull/4800))
- Fixed a bug in `.ts` -> `.js` conversion on Windows by using a relative unix-style path ([#4718](https://github.com/remix-run/remix/pull/4718))

See the `CHANGELOG.md` in individual Remix packages for all changes.
