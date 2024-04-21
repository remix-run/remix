---
"@remix-run/react": patch
---

Opt-in types for single-fetch

To opt-in to type inference for single-fetch, add `future/single-fetch.d.ts` to `include` in your `tsconfig.json`:

```json
{
  "include": [
    "./node_modules/@remix-run/react/future/single-fetch.d.ts"
  ]
}
```

This changes `useLoaderData` and `useActionData` types to return single-fetch aware types instead of `SerializedFrom` types:


```ts
const loader = () => {
  return { hello: "world", date: new Date() }
}

// Without opting into single-fetch types
// Types from `loader` are serialized via `JSON.stringify` and `JSON.parse`
const before = useLoaderData<typeof loader>();
//    ^? { hello: string, date: string }

// Opting into single-fetch types
// Types from `loader` are serialized via `turbo-stream`
const after = useLoaderData<typeof loader>();
//    ^? { hello: string, date: Date }
```
