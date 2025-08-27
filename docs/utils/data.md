---
title: data
toc: false
---

# `data`

This is a utility for use with [Single Fetch][single-fetch] to return raw data accompanied by a status code or custom response headers. This avoids the need to serialize your data into a `Response` instance to provide custom status/headers. This is generally a replacement for `loader`/`action` functions that used [`json`][json] or [`defer`][defer] prior to Single Fetch.

```tsx
import { data } from "@remix-run/node"; // or cloudflare/deno

export const loader = async () => {
  return data(
    { not: "coffee" },
    {
      status: 418,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
};
```

You should _not_ be using this function if you don't need to return custom status/headers - in that case, just return the data directly:

```tsx
export const loader = async () => {
  // ❌ Bad
  return data({ not: "coffee" });

  // ✅ Good
  return { not: "coffee" };
};
```

[single-fetch]: ../guides/single-fetch
[json]: ./json
[defer]: ./defer
