---
"@remix-run/cloudflare": patch
"@remix-run/deno": patch
"@remix-run/node": patch
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

Typesafety for single-fetch: defineLoader, defineClientLoader, defineAction, defineClientAction

`defineLoader` and `defineAction` are helpers for authoring `loader`s and `action`s.
They are identity functions; they don't modify your loader or action at runtime.
Rather, they exist solely for typesafety by providing types for args and by ensuring valid return types.

```ts
export let loader = defineLoader(({ request }) => {
  //                                ^? Request
  return { a: 1, b: () => 2 };
  //           ^ type error: `b` is not serializable
});
```

Note that `defineLoader` and `defineAction` are not technically necessary for defining loaders and actions if you aren't concerned with typesafety:

```ts
// this totally works! and typechecking is happy too!
export let loader = () => {
  return { a: 1 };
};
```

This means that you can opt-in to `defineLoader` incrementally, one loader at a time.

You can return custom responses via the `json`/`defer` utilities, but doing so will revert back to the old JSON-based typesafety mechanism:

```ts
let loader1 = () => {
  return { a: 1, b: new Date() };
};
function Component() {
  let data1 = useLoaderData<typeof loader1>();
  //  ^? {a: number, b: Date}
}

let loader2 = () => {
  return json({ a: 1, b: new Date() }); // this opts-out of turbo-stream
};
function Component2() {
  let data2 = useLoaderData<typeof loader2>();
  //  ^? JsonifyObject<{a: number, b: Date}> which is really {a: number, b: string}
}
```

You can also continue to return totally custom responses with `Response` though this continues to be outside of the typesystem since the built-in `Response` type is not generic
