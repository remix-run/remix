---
title: headers
---

# `headers`

Each route can define its own HTTP headers. One of the common headers is the [`Cache-Control` header][cache-control-header] that indicates to browser and CDN caches where and for how long a page is able to be cached.

```tsx
import type { HeadersFunction } from "@remix-run/node"; // or cloudflare/deno

export const headers: HeadersFunction = ({
  actionHeaders,
  errorHeaders,
  loaderHeaders,
  parentHeaders,
}) => ({
  "X-Stretchy-Pants": "its for fun",
  "Cache-Control": "max-age=300, s-maxage=3600",
});
```

Usually your data is a better indicator of your cache duration than your route module (data tends to be more dynamic than markup), so the [`action`][action]'s & [`loader`][loader]'s headers are passed in to `headers()` too:

```tsx
import type { HeadersFunction } from "@remix-run/node"; // or cloudflare/deno

export const headers: HeadersFunction = ({
  loaderHeaders,
}) => ({
  "Cache-Control": loaderHeaders.get("Cache-Control"),
});
```

Note: `actionHeaders` & `loaderHeaders` are an instance of the [Web Fetch API `Headers`][headers] class.

If an `action` or a `loader` threw a [`Response`][response] and we're rendering a boundary, any headers from the thrown `Response` will be available in `errorHeaders`. This allows you to access headers from a child loader that threw in a parent error boundary.

## Nested Routes

Because Remix has nested routes, there's a battle of the headers to be won when nested routes match. The default behavior is that Remix only leverages the resulting headers from the deepest `headers` function it finds in the renderable matches (up to and including the boundary route if an error is present).

```
├── users.tsx
├── users.$userId.tsx
└── users.$userId.profile.tsx
```

If we are looking at `/users/123/profile` then three routes are rendering:

```tsx
<Users>
  <UserId>
    <Profile />
  </UserId>
</Users>
```

If a user is looking at `/users/123/profile` and `users.$userId.profile.tsx` does not export a `headers` function, then Remix will use the return value of `users.$userId.tsx`'s `headers` function. If that file doesn't export one, then it will use the result of the one in `users.tsx`, and so on.

If all three define `headers`, the deepest module wins, in this case `users.$userId.profile.tsx`. However, if your `users.$userId.profile.tsx`'s `loader` threw and bubbled to a boundary in `users.$userId.tsx` - then `users.$userId.tsx`'s `headers` function would be used as it is the leaf rendered route.

We don't want surprise headers in your responses, so it's your job to merge them if you'd like. Remix passes in the `parentHeaders` to your `headers` function. So `users.tsx` headers get passed to `users.$userId.tsx`, and then `users.$userId.tsx`'s `headers` are passed to `users.$userId.profile.tsx`'s `headers`.

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

Note that you can also add headers in your [`entry.server.tsx`][entry-server] file for things that should be global, for example:

```tsx filename=app/entry.server.tsx lines=[20]
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
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
```

Just keep in mind that doing this will apply to _all_ document requests, but does not apply to `data` requests (for client-side transitions for example). For those, use [`handleDataRequest`][handle-data-request].

[cache-control-header]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
[action]: ./action
[loader]: ./loader
[headers]: https://developer.mozilla.org/en-US/docs/Web/API/Headers
[response]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[entry-server]: ../file-conventions/entry.server
[handle-data-request]: ../file-conventions/entry.server#handledatarequest
