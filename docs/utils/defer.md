---
title: defer
---

# `defer`

This is a shortcut for creating a streaming/deferred response. It assumes you are using `utf-8` encoding. From a developer perspective it behaves just like [`json()`][json], but with the ability to transport promises to your UI components.

```ts lines=[2,5,10]
import type { LoaderFunction } from "@remix-run/node"; // or cloudflare/deno
import { defer } from "@remix-run/node"; // or cloudflare/deno

export const loader: LoaderFunction = async () => {
  const aStillRunningPromise = loadSlowDataAsync();

  // So you can write this without awaiting the promise:
  return defer({
    critical: "data",
    slowPromise: aStillRunningPromise,
  });
};
```

You can also pass a status code and headers:

```ts lines=[9-14]
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

## How to update an older Remix app to use `defer`

- Update all `@remix-run/*` packages to the latest version
- Update `react` and `react-dom` to the latest version, `18` or above
- If using TypeScript, update `@types/react` and `@types/react-dom` to the latest version
- Find the [adapter you're using](https://github.com/remix-run/remix/tree/dev/templates) and update your `app/entry.client.tsx` and `app/entry.server.tsx` files to match what is in the template. This will ensure that your project supports React 18 hydration on the client and streaming responses on the server.
- You should be ready to use `defer`!

[json]: ./json
