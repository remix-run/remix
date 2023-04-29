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

add `HeadersFunctionArgs` type to be consistent with loaders/actions/meta and allows for using `function`

```tsx
import type { HeadersFunctionArgs } from '@remix-run/*';

export function headers({ loaderHeaders }: HeadersFunctionArgs) {
  return {
    "x-my-custom-thing": loaderHeaders.get("x-my-custom-thing") || "fallback"
  }
}
```
