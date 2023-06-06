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
  errorHeaders,
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

If an action or a loader threw a `Response` and we're rendering a boundary, any headers from the thrown `Response` will be available in `errorHeaders`. This allows you to access headers from a child loader that threw in a parent error boundary.

## Nested Routes

Because Remix has nested routes, there's a battle of the headers to be won when nested routes match. The default behavior is that Remix only leverages the resulting headers from the leaf rendered route. Consider these files in the routes directory:

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

If all three define `headers`, the deepest module wins, in this case `profile.tsx`. However, if your `profile.tsx` loader threw and bubbled to a boundary in `userId.tsx` - then `userId.tsx`'s `headers` function would be used as it is the leaf rendered route.

<docs-info>
We realize that it can be tedious and error-prone to have to define `headers` on every possible leaf route so we're changing the current behavior in v2 behind the [`future.v2_headers`][v2_headers] flag.
</docs-info>

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

```tsx lines=[20]
import type {
  AppLoadContext,
  EntryContext,
} from "@remix-run/node"; // or cloudflare/deno
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  loadContext: AppLoadContext
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

## v2 Behavior

Since it can be tedious and error-prone to define a `header` function in every single possible leaf route, we're changing the behavior slightly in v2 and you can opt-into the new behavior via the `future.v2_headers` [Future Flag][future-flags] in `remix.config.js`.

When enabling this flag, Remix will now use the deepest `headers` function it finds in the renderable matches (up to and including the boundary route if an error is present). You'll still need to handle merging together headers as shown above for any `headers` functions above this route.

This means that, re-using the example above:

```
├── users.tsx
└── users
    ├── $userId.tsx
    └── $userId
        └── profile.tsx
```

If a user is looking at `/users/123/profile` and `profile.tsx` does not export a `headers` function, then Remix will use the return value of `$userId.tsx`'s `headers` function. If that file doesn't export one, then it will use the result of the one in `users.tsx`, and so on.

[headers]: https://developer.mozilla.org/en-US/docs/Web/API/Headers
[handledatarequest]: ../file-conventions/entry.server
[v2_headers]: #v2-behavior
[future-flags]: ../pages/api-development-strategy
