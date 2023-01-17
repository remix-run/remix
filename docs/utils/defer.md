---
title: defer
---

# `defer`

This is a shortcut for creating a streaming/deferred response. It assumes you are using `utf-8` encoding. From a developer perspective it behaves just like [`json()`][json], but with the ability to transport promises to your UI components.

```ts lines=[2,6]
import type { LoaderFunction } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader: LoaderFunction = async () => {
  const aStillRunningPromise = loadSlowDataAsync();

  // So you can write this without awaiting the promise:
  return json({
    critical: "data",
    slowPromise: aStillRunningPromise,
  });
};
```

You can also pass a status code and headers:

```ts lines=[4-9]
export const loader: LoaderFunction = async () => {
  const aStillRunningPromise = loadSlowDataAsync();

  return defer(
    {
      critical: "data",
      slowPromise: aStillRunningPromise,
    },
    {
      status: 418,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
};
```

[json]: ./json
