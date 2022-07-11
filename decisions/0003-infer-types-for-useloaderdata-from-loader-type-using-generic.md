# Infer types for `useLoaderData` from `loader` type using generic

Date: 2022-07-11

Status: accepted

## Context

Most of the discussion happened on two pull requests:
- [remix-run/remix#1254](https://github.com/remix-run/remix/pull/1254)
- [remix-run/remix#3276](https://github.com/remix-run/remix/pull/3276)

While the team was largely in favor of inferring the types for `useLoaderData` based on `loader`, there was [hesitance to use a Typescript generic to do so](https://github.com/remix-run/remix/pull/3276#issuecomment-1164764821).
Typescript generics seemed best for specifying or inferring types for _inputs_, not for forcing Typescript to view outputs as certain type.

A key factor in the decision was identifying that `loader` is an _implicit_ input of `useLoaderData`.
In other words, if `loader` and `useLoaderData` were guaranteed to run in the same process (and not cross the network), then we could write `useLoaderData(loader)`, specifying `loader` as an explicit input for `useLoaderData`.

```ts
// _conceptually_ `loader` is an input for `useLoaderData`
function useLoaderData<Loader extends LoaderFunction>(loader: Loader) {/*...*/}
```

Though `loader` and `useLoaderData` exist together in the same file at development-time, `loader` does not exist at runtime in the browser.
Without the `loader` argument to infer types from, `useLoaderData` needs a way to learn about `loader`'s type at compile-time.


Additionally, `loader` and `useLoaderData` are both managed by Remix across the network.
While its true that Remix doesn't "own" the network in the strictest sense, having `useLoaderData` return data that does not correspond to its `loader` is an exceedingly rare edge-case.
A similar case is how [Prisma](https://www.prisma.io/) infers types from database schemas available at runtime, even though there are (exceedingly rare) edge-cases where that database schema _could_ be mutated after compile-time but before run-time.

## Decision

Explicitly provide type of the implicit `loader` input for `useLoaderData` and then infer the return type for `useLoaderData`.

```ts
export const loader = async (args: LoaderArgs) => {
  // ...
  return json(/*...*/)
}

export default function Route() {
  let data = useLoaderData<typeof loader>()
  // ...
}
```

Additionally, the inferred return type for `useLoaderData` will only include serializable (JSON) types.

## Consequences

Types for `useLoaderData` can be inferred from `loader`'s return type, ensuring that types for `useLoaderData` as always in-sync with the _actual_ implementation of your `loader`.

### Loaders MUST NOT return bare objects when relying on `loader` type inference

Users who opt-in to type inference via generic (`useLoaderData<typeof loader>`) **MUST NOT** return bare objects, but should instead use the `json` helper:

```ts
const loader = () => {
  // NO
  return { hello: "world" }

  // YES
  return json({ hello: "world" })
}
```

### Users can still provide non-inferred types

Users can still provide their own non-inferred types for `useLoaderData` either with `as` or with a generic:

```ts
type MyLoaderData = {/*...*/}

export default function Route() {
  let option1 = useLoaderData() as MyLoaderData
  let option2 = useLoaderData<MyLoaderData>()
}
```

However, Typescript will now correctly report errors when the user-defined type for `useLoaderData` includes non-serialized types.
For example, a `Date` returned by `loader` will be serialized to a `string` in the return value of `useLoaderData`:

```ts
type MyLoaderData = {
  foo: Date
}

export default function Route() {
  let option1 = useLoaderData() as MyLoaderData // TS error: Type 'string' is not comparable to type 'Date'.
  let option2 = useLoaderData<MyLoaderData>() // TS error: Type 'string' is not comparable to type 'Date'.
}
```

While fixing this footgun should be desirable in the vast majority of use-cases, users can always cast to `unknown` first as an escape hatch:

```ts
export default function Route() {
  // NOT RECOMMENDED
  let option1 = useLoaderData() as unknown as MyLoaderData
}
```
