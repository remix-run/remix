---
"remix": patch
"@remix-run/serve": patch
"@remix-run/server-runtime": patch
---

Fix `TypedResponse` so that Typescript correctly shows errors for incompatible types in `loader` and `action` functions.

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

This happens because `json` returns a `TypedResponse<string>`,
but because `TypedReponse<string>` was previously just `Response & { json: () => Promise<string> }`
and `Response` already defines `{ json: () => Promise<any> }`, type erasure caused `Promise<any>` to be used for `42`.

To fix this, we explicitly omit the `Response` object's `json` property before intersecting with `{ json: () => Promise<T> }`.
