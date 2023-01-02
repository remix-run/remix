---
title: json
---

# `json`

This is a shortcut for creating `application/json` responses. It assumes you are using `utf-8` encoding.

```ts lines=[2,6]
import type { LoaderFunction } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader: LoaderFunction = async () => {
  // So you can write this:
  return json({ any: "thing" });

  // Instead of this:
  return new Response(JSON.stringify({ any: "thing" }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
```

You can also pass a status code and headers:

```ts lines=[4-9]
export const loader: LoaderFunction = async () => {
  return json(
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
