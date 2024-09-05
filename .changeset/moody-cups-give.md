---
"@remix-run/cloudflare": patch
"@remix-run/deno": patch
"@remix-run/node": patch
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

Single Fetch: Improved typesafety

If you were already using previously released unstable single-fetch types:

- Remove `"@remix-run/react/future/single-fetch.d.ts"` override from `tsconfig.json` > `compilerOptions` > `types`
- Remove `defineLoader`, `defineAction`, `defineClientLoader`, `defineClientAction` helpers from your route modules
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

For more information, see [Guides > Single Fetch](https://remix.run/docs/en/dev/guides/single-fetch) in our docs.
