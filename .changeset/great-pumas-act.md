---
"@remix-run/netlify": patch
"@remix-run/server-runtime": patch
---

We've added type safety for load context. `AppLoadContext` is now an an interface mapping `string` to `unknown`, allowing users to extend it via module augmentation:

```ts
declare module "@remix-run/server-runtime" {
  interface AppLoadContext {
    // add custom properties here!
  }
}
```
