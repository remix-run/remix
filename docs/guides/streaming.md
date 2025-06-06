---
title: Streaming
description: When, why, and how to stream with React 18 and Remix's deferred API.
---

# Streaming

Streaming allows you to enhance user experience by delivering content as soon as it's available, rather than waiting for the entire content of a page to be ready.

Ensure your hosting provider supports streaming; not all of them do. If your responses don't seem to stream, this might be the cause.

## Steps

There are three steps to streaming data:

1. **Project Setup:** we need to make sure our client and server entry points are set up to support streaming
2. **Component Setup:** we need to make sure our components can render streamed data
3. **Deferring Loader Data:** finally we can defer data in our loaders

## 1. Project Setup

**Ready from Start:** Remix apps created using starter templates are pre-configured for streaming.

**Manual Setup Needed?:** If your project began from scratch or used an older template, verify `entry.server.tsx` and `entry.client.tsx` have streaming support. If you don't see these files, then you are using the defaults and streaming is supported. If you have created your own entries, the following are the template defaults for your reference:

- [entry.client.tsx][entry_client_tsx]
- entry.server.tsx:
  - [cloudflare][entry_server_cloudflare_tsx]
  - [deno][entry_server_deno_tsx]
  - [node][entry_server_node_tsx]

## 2. Component Setup

A route module without streaming might look like this:

```tsx
import type { LoaderFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";

export async function loader({
  params,
}: LoaderFunctionArgs) {
  const [product, reviews] = await Promise.all([
    db.getProduct(params.productId),
    db.getReviews(params.productId),
  ]);

  return json({ product, reviews });
}

export default function Product() {
  const { product, reviews } =
    useLoaderData<typeof loader>();
  return (
    <>
      <ProductPage data={product} />
      <ProductReviews data={reviews} />
    </>
  );
}
```

To render streamed data, you need to use [`<Suspense>`][suspense_component] from React and [`<Await>`][await_component] from Remix. It's a bit of boilerplate, but straightforward:

```tsx lines=[3-4,20-24]
import type { LoaderFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { ReviewsSkeleton } from "./reviews-skeleton";

export async function loader({
  params,
}: LoaderFunctionArgs) {
  // existing code
}

export default function Product() {
  const { product, reviews } =
    useLoaderData<typeof loader>();
  return (
    <>
      <ProductPage data={product} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <Await resolve={reviews}>
          {(reviews) => <ProductReviews data={reviews} />}
        </Await>
      </Suspense>
    </>
  );
}
```

This code will continue to work even before we start deferring data. It's a good idea to do the component code first. If you run into issues, it's easier to track down where the problem lies.

## 3. Deferring Data in Loaders

Now that our project and route component are set up stream data, we can start deferring data in our loaders. We'll use the [`defer`][defer] utility from Remix to do this.

Note the change in the async promise code.

```tsx lines=[2,11-19]
import type { LoaderFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import { defer } from "@remix-run/node"; // or cloudflare/deno
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { ReviewsSkeleton } from "./reviews-skeleton";

export async function loader({
  params,
}: LoaderFunctionArgs) {
  // 👇 note this promise is not awaited
  const reviewsPromise = db.getReviews(params.productId);
  // 👇 but this one is
  const product = await db.getProduct(params.productId);

  return defer({
    product,
    reviews: reviewsPromise,
  });
}

export default function Product() {
  const { product, reviews } =
    useLoaderData<typeof loader>();
  // existing code
}
```

Instead of awaiting the `reviews` promise, we pass it to `defer`. This tells Remix to stream that promise over the network to the browser.

That's it! You should now be streaming data to the browser.

## Avoid Inefficient Streaming

It's important to initiate promises for deferred data _before_ you await any other promises, otherwise you won't get the full benefit of streaming. Note the difference with this less efficient code example:

```tsx bad
export async function loader({
  params,
}: LoaderFunctionArgs) {
  const product = await db.getProduct(params.productId);
  // 👇 this won't initiate loading until `product` is done
  const reviewsPromise = db.getReviews(params.productId);

  return defer({
    product,
    reviews: reviewsPromise,
  });
}
```

## Handling Server Timeouts

When using `defer` for streaming, you can tell Remix how long to wait for deferred data to resolve before timing out via the `<RemixServer abortDelay>` prop (which defaults to 5 seconds) in your `entry.server.tsx` file. If you don't currently have an `entry.server.tsx` file you can expose it via `npx remix reveal entry.server`. You can also use this value to abort the React `renderToPipeableStream` method via a `setTimeout`.

```tsx filename=entry.server.tsx lines=[1,9,16]
const ABORT_DELAY = 5_000;

// ...

const { pipe, abort } = renderToPipeableStream(
  <RemixServer
    context={remixContext}
    url={request.url}
    abortDelay={ABORT_DELAY}
  />
  // ...
);

// ...

setTimeout(abort, ABORT_DELAY);
```

## Streaming with a Content Security Policy

Streaming works by inserting script tags into the DOM as deferred promises resolve. If your page includes a [Content Security Policy for scripts][csp], you'll either need to weaken your security policy by including `script-src 'self' 'unsafe-inline'` in your `Content-Security-Policy` header, or add nonces to all of your script tags.

If you are using a `nonce`, it needs to be included in three places:

- The `Content-Security-Policy` header, like so: `Content-Security-Policy: script-src 'nonce-secretnoncevalue'`
- The `<Scripts />`, `<ScrollRestoration />` and `<LiveReload />` components, like so: `<Scripts nonce="secretnoncevalue" />`
- In `entry.server.ts` where you call `renderToPipeableStream`, like so:

```tsx filename=entry.server.tsx
const { pipe, abort } = renderToPipeableStream(
  <RemixServer
    context={remixContext}
    url={request.url}
    abortDelay={ABORT_DELAY}
  />,
  {
    nonce: "secretnoncevalue",
    /* ...remaining fields */
  }
);
```

This will ensure the nonce value is included on any deferred script tags.

[entry_client_tsx]: https://github.com/remix-run/remix/blob/dev/packages/remix-dev/config/defaults/entry.client.tsx
[entry_server_cloudflare_tsx]: https://github.com/remix-run/remix/blob/dev/packages/remix-dev/config/defaults/entry.server.cloudflare.tsx
[entry_server_deno_tsx]: https://github.com/remix-run/remix/blob/dev/packages/remix-dev/config/defaults/entry.server.deno.tsx
[entry_server_node_tsx]: https://github.com/remix-run/remix/blob/dev/packages/remix-dev/config/defaults/entry.server.node.tsx
[suspense_component]: https://react.dev/reference/react/Suspense
[await_component]: ../components/await
[defer]: ../utils/defer
[csp]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src
