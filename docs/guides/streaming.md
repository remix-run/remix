---
title: Streaming
description: When, why, and how to stream with React 18 and Remix's deferred API.
---

# Streaming

Streaming allows you to enhance user experience by delivering content as soon as it's available, rather than waiting for the entire content of a page to be ready.

Ensure your hosting provider supports streaming, not all of them do. If your responses don't seem to stream, this might be the cause.

## Steps

There are three steps to streaming data:

1. **Project Setup:** we need to make sure our server and client entry points are set up to support streaming
2. **Component Setup:** we need to make sure our components can render streamed data
3. **Deferring Loader Data:** finally we can defer data in our loaders

## 1. Project Setup

**Ready from Start:** Remix apps created using starter templates are pre-configured for streaming.

**Manual Setup Needed?:** If your project began from scratch or used an older template, verify `entry.server.tsx` and `entry.client.tsx` have streaming support. If you don't see these files then you are using the defaults and streaming is supported. If you have created your own entries, the following are the template defaults for your reference:

- [entry.client.tsx][entry-client-tsx]
- [entry.server.tsx][entry-server-tsx]

## 2. Component Setup

A route module without streaming might look like this:

```tsx
import { useLoaderData } from "@remix-run/react";

export async function loader({ params }) {
  const [product, reviews] = await Promise.all([
    db.getProduct(params.productId),
    db.getReviews(params.productId),
  ]);

  return { product, reviews };
}

export default function Product() {
  const { product, reviews } = useLoaderData();
  return (
    <>
      <ProductPage data={product} />
      <ProductReviews data={reviews} />
    </>
  );
}
```

In order to render streamed data, you need to use `<Suspense>` from React and `<Await>` from Remix. It's a bit of boilerplate, but straightforward:

```tsx lines=[1,2,13-17]
import { useLoaderData, Await } from "@remix-run/react";
import { Suspense } from "react";

export async function loader({ params }) {
  // existing code
}

export default function Product() {
  const { product, reviews } = useLoaderData();
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

Now that our project and route component are set up stream data, we can start deferring data in our loaders. We'll use the `defer` utility from Remix to do this.

Note the change in the async promise code.

```tsx lines=[1,6-14]
import { defer } from "@remix-run/node";
import { useLoaderData, Await } from "@remix-run/react";
import { Suspense } from "react";

export async function loader({ params }) {
  // 👇 note this promise is not awaited
  const reviewsPromise = db.getReviews(params.productId);
  // 👇 but this one is
  const product = await db.getProduct(params.productId);

  return defer({
    product,
    reviews: reviewsPromise,
  });
}

export default function SomeRoute() {
  const { product, reviews } = useLoaderData();

  // existing code
}
```

Instead of awaiting the reviews promise, we pass it to `defer`. This tells Remix to stream that promise over the network to the browser.

That's it! You should now be streaming data to the browser.

## Avoid Inefficient Streaming

It's important to initiate promises for deferred data _before_ you await any other promises, otherwise you won't get the full benefit of streaming. Note the difference with this less efficient code example:

```tsx bad
export async function loader({ params }) {
  const product = await db.getProduct(params.productId);
  // 👇 this won't initiate loading until `product` is done
  const reviewsPromise = db.getReviews(params.productId);

  return defer({
    product,
    reviews: reviewsPromise,
  });
}
```

[await]: ../components/await
[defer]: ../utils/defer
[link]: ../components/link
[usefetcher]: ../hooks/use-fetcher
[useasyncvalue]: ../api/remix#useasyncvalue
[react-lazy]: https://reactjs.org/docs/code-splitting.html#reactlazy
[web-streaming-api]: https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
[graphs-showing-how-document-and-slow-data-requests-sent-over-the-same-response-significantly-speed-up-the-largest-contentful-paint]: https://user-images.githubusercontent.com/12063586/179609347-36bd7d32-c8af-4e24-9e89-06d9abc0a19f.svg
[entry-client-tsx]: https://github.com/remix-run/remix/blob/main/packages/remix-dev/config/defaults/entry.client.react-stream.tsx
[entry-server-tsx]: https://github.com/remix-run/remix/blob/main/packages/remix-dev/config/defaults/node/entry.server.react-stream.tsx
