---
"remix": patch
"@remix-run/cloudflare": patch
"@remix-run/deno": patch
"@remix-run/dev": patch
"@remix-run/eslint-config": patch
"@remix-run/node": patch
"@remix-run/serve": patch
"@remix-run/server-runtime": patch
---

Add `HeadersArgs` type to be consistent with loaders/actions/meta and allows for using a `function` declaration in addition to an arrow function expression

```tsx
import type { HeadersArgs } from "@remix-run/node"; // or cloudflare/deno

export function headers({ loaderHeaders }: HeadersArgs) {
  return {
    "x-my-custom-thing": loaderHeaders.get("x-my-custom-thing") || "fallback",
  };
}
```
