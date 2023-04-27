---
title: headers
---

# `headers`

Each route can define its own HTTP headers. One of the common headers is the `Cache-Control` header that indicates to browser and CDN caches where and for how long a page is able to be cached.

```tsx
import type { HeadersFunction } from "@remix-run/node"; // or cloudflare/deno

export const headers: HeadersFunction = ({
  actionHeaders,
  loaderHeaders,
  parentHeaders,
}) => ({
  "X-Stretchy-Pants": "its for fun",
  "Cache-Control": "max-age=300, s-maxage=3600",
});
```

Usually your data is a better indicator of your cache duration than your route module (data tends to be more dynamic than markup), so the `action`'s & `loader`'s headers are passed in to `headers()` too:

```tsx
import type { HeadersFunction } from "@remix-run/node"; // or cloudflare/deno

export const headers: HeadersFunction = ({
  loaderHeaders,
}) => ({
  "Cache-Control": loaderHeaders.get("Cache-Control"),
});
```

Note: `actionHeaders` & `loaderHeaders` are an instance of the [Web Fetch API][headers] `Headers` class.

Because Remix has nested routes, there's a battle of the headers to be won when nested routes match. In this case, the deepest route wins. Consider these files in the routes directory:

```
├── users.tsx
└── users
    ├── $userId.tsx
    └── $userId
        └── profile.tsx
```

If we are looking at `/users/123/profile` then three routes are rendering:

```tsx
<Users>
  <UserId>
    <Profile />
  </UserId>
</Users>
```

If all three define `headers`, the deepest module wins, in this case `profile.tsx`.

We don't want surprise headers in your responses, so it's your job to merge them if you'd like. Remix passes in the `parentHeaders` to your `headers` function. So `users.tsx` headers get passed to `$userId.tsx`, and then `$userId.tsx` headers are passed to `profile.tsx` headers.

That is all to say that Remix has given you a very large gun with which to shoot your foot. You need to be careful not to send a `Cache-Control` from a child route module that is more aggressive than a parent route. Here's some code that picks the least aggressive caching in these cases:

```tsx
import type { HeadersFunction } from "@remix-run/node"; // or cloudflare/deno
import parseCacheControl from "parse-cache-control";

export const headers: HeadersFunction = ({
  loaderHeaders,
  parentHeaders,
}) => {
  const loaderCache = parseCacheControl(
    loaderHeaders.get("Cache-Control")
  );
  const parentCache = parseCacheControl(
    parentHeaders.get("Cache-Control")
  );

  // take the most conservative between the parent and loader, otherwise
  // we'll be too aggressive for one of them.
  const maxAge = Math.min(
    loaderCache["max-age"],
    parentCache["max-age"]
  );

  return {
    "Cache-Control": `max-age=${maxAge}`,
  };
};
```

All that said, you can avoid this entire problem by _not defining headers in parent routes_ and only in leaf routes. Every layout that can be visited directly will likely have an "index route". If you only define headers on your leaf routes, not your parent routes, you will never have to worry about merging headers.

Note that you can also add headers in your `entry.server` file for things that should be global, for example:

```tsx lines=[16]
import { renderToString } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import type { EntryContext } from "@remix-run/node"; // or cloudflare/deno

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );

  responseHeaders.set("Content-Type", "text/html");
  responseHeaders.set("X-Powered-By", "Hugs");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
```

Just keep in mind that doing this will apply to _all_ document requests, but does not apply to `data` requests (for client-side transitions for example). For those, use [`handleDataRequest`][handledatarequest].

[headers]: https://developer.mozilla.org/en-US/docs/Web/API/Headers
[handledatarequest]: ../file-conventions/entry.server
