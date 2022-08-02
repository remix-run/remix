---
"@remix-run/netlify": minor
"@remix-run/server-runtime": minor
---

Type safety for load context.

Change `AppLoadContext` to be an interface mapping `string` to `unknown`, allowing users to extend it via:

```ts


declare module "@remix-run/server-runtime" {
  interface AppLoadContext {
    // add custom properties here!
  }
}
```