---
title: defer
toc: false
---

# `defer`

To get started with streaming data, check out the [Streaming Guide][streaming_guide].

This is a shortcut for creating a streaming/deferred response. It assumes you are using `utf-8` encoding. From a developer perspective it behaves just like [`json()`][json], but with the ability to transport promises to your UI components.

```tsx lines=[1,7-10]
import { defer } from "@remix-run/node"; // or cloudflare/deno

export const loader = async () => {
  const aStillRunningPromise = loadSlowDataAsync();

  // So you can write this without awaiting the promise:
  return defer({
    critical: "data",
    slowPromise: aStillRunningPromise,
  });
};
```

You can also pass a status code and headers:

```tsx lines=[9-14]
export const loader = async () => {
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

[streaming_guide]: ../guides/streaming
[json]: ./json
