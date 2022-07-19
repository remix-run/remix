---
title: Streaming
description: When, why, and how to stream with React 18 and Remix's deferred API.
---

# Streaming

Remix supports the [web streaming API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) as a first-class citizen. Additionally, JavaScript server runtimes have support for streaming responses to the client.

One problem streaming in React 18 solves is for lazy-loading chunks of your code you don't want in your server render (for example, if a component doesn't support server-rendering). Once you enable React 18 streaming, you can use [`React.lazy`][react-lazy] on the server and the fallback will be rendered on the server and the client will fetch the code and render the components.

But there's a more nuanced problem that streaming solves. Let's look into that:

## The problem

Imagine a scenario where one of your routes' loaders needs to retrieve some data that for one reason or another is quite slow. For example, let's say you're showing the user the location of a package that's being delivered to their home:

```tsx
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { getPackageLocation } from "~/models/packages";

type LoaderData = {
  packageLocation: {
    latitude: number;
    longitude: number;
  };
};

export const loader: LoaderFunction = ({ params }) => {
  const packageLocation = await getPackageLocation(
    params.packageId
  );

  return json<LoaderData>({
    packageLocation,
  });
};

export default function PackageRoute() {
  const data = useLoaderData() as LoaderData;
  const { packageLocation } = data;

  return (
    <main>
      <h1>Let's locate your package</h1>
      <p>
        Your package is at {packageLocation.latitude} lat
        and {packageLocation.longitude} long.
      </p>
    </main>
  );
}
```

We'll assume that `getPackageLocation` is slow. This will lead to initial page load times and transitions to that route to take as long as the slowest bit of data. There are a few things you can do to optimize this and improve the user experience:

- Speed up the slow thing (😅).
- Parallelize data loading with `Promise.all` (we have nothing to parallelize in our example, but it might help a bit in other situations).
- Use the [`prefetch` prop on `<Link />`][link] (only helps client-side transitions, not initial page load).
- Add caching (not possible/reasonable in some cases).
- Add a global transition spinner (only helps improve UX client-side transitions).
- Add a localized skeleton UI (only helps improve UX client-side transitions).

If these approaches don't work well, then you may feel forced to move the slow data out of the Remix loader into a client-side fetch (and show a skeleton fallback UI while loading). In this case you'd render the fallback UI on the server render and fire off the fetch for the data on the client. This is actually not so terrible from a DX standpoint thanks to [`useFetcher`][usefetcher]. And from a UX standpoint this improves the loading experience for both client-side transitions as well as initial page load. So it does seem to solve the problem.

But it's still sub optimal for two reasons:

1. Client-side fetching puts your data request on a waterfall: document -> JavaScript -> data fetch
2. Your code can't easily switch between client-side fetching and server-side rendering (more on this later).

## The solution

Remix takes advantage of React 18's streaming and server-side support for `<Suspense />` boundaries using the [`deferred` Response][deferred-response] utility and [`<Deferred />`][deferred] component / [`useDeferredData`][usedeferreddata] hook. By using these APIs, you can solve both of these problems:

1. You're data is no longer on a waterfall: document & data (in parallel) -> JavaScript
2. Your can easily switch between streaming and waiting for the data

![Graphs showing how document and slow data requests sent over the same response significantly speed up the largest contentful paint](https://user-images.githubusercontent.com/12063586/179609347-36bd7d32-c8af-4e24-9e89-06d9abc0a19f.svg)

Let's take a dive into how to accomplish this.

### Enable React 18 Streaming

First, to enable streaming with React 18, you'll update your `entry.server.tsx` file to use `renderToPipeableStream`. Here's a simple (and incomplete) version of that:

```tsx filename=app/entry.server.tsx lines=[1-2,17,24,29,34]
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import { Response } from "@remix-run/node";
import type {
  EntryContext,
  Headers,
} from "@remix-run/node";

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve) => {
    const { pipe } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
      />,
      {
        onShellReady() {
          const body = new PassThrough();

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(body, {
              status: responseStatusCode,
              headers: responseHeaders,
            })
          );
          pipe(body);
        },
      }
    );
  });
}
```

<details>
  <summary>For a more complete example, expand this</summary>

This handles errors and properly disables streaming for bots which you typically want to force waiting so you can display all the content for SEO purposes.

```tsx filename=app/entry.server.tsx
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import { Response } from "@remix-run/node";
import type {
  EntryContext,
  Headers,
} from "@remix-run/node";
import isbot from "isbot";

const ABORT_DELAY = 5000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const callbackName = isbot(
    request.headers.get("user-agent")
  )
    ? "onAllReady"
    : "onShellReady";

  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
      />,
      {
        [callbackName]() {
          let body = new PassThrough();

          responseHeaders.set(
            "Content-Type",
            "text/html; charset=UTF-8"
          );

          resolve(
            new Response(body, {
              status: didError ? 500 : responseStatusCode,
              headers: responseHeaders,
            })
          );
          pipe(body);
        },
        onShellError(err: unknown) {
          reject(err);
        },
        onError(error: unknown) {
          didError = true;
          console.error(error);
        },
      }
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
```

</details>

Then on the client you need to make sure you're hydrating properly with the React 18 `hydrateRoot` API:

```tsx filename=app/entry.client.tsx lines=[2,4]
import { RemixBrowser } from "@remix-run/react";
import { hydrateRoot } from "react-dom/client";

hydrateRoot(document, <RemixBrowser />);
```

With just that in place, you're unlikely to see any significant performance improvement. But with that alone you can now use [`React.lazy`][react-lazy] to SSR components but delay hydration on the client. This can open up network bandwidth for more critical things like styles, images, and fonts leading to a better LCP and TTI.

### Using `deferred`

With React streaming setup, now you can start adding `Deferred` usage for your slow data requests where you'd rather render a fallback UI. Let's do that for our example above:

```tsx lines=[1,3,4,9-11,13-15,24-33,38-40]
import { Suspense } from "react";
import type { LoaderArgs } from "@remix-run/node";
import { deferred } from "@remix-run/node";
import { Deferred, useLoaderData } from "@remix-run/react";

import { getPackageLocation } from "~/models/packages";

export function loader({ params }: LoaderArgs) {
  const packageLocationPromise = getPackageLocation(
    params.packageId
  );

  return deferred({
    packageLocation: packageLocationPromise,
  });
}

export default function PackageRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <main>
      <h1>Let's locate your package</h1>
      <Suspense
        fallback={<p>Loading package location...</p>}
      >
        <Deferred
          value={data.packageLocation}
          errorElement={
            <p>Error loading package location!</p>
          }
        >
          {(packageLocation) => (
            <p>
              Your package is at {packageLocation.latitude}{" "}
              lat and {packageLocation.longitude} long.
            </p>
          )}
        </Deferred>
      </Suspense>
    </main>
  );
}
```

<details>
  <summary>Alternatively, you can use the `useDeferredData` hook:</summary>

If you're not jazzed about bringing back render props, you can use a hook, but you'll have to break things out into another component:

```tsx lines=[18,26-31]
import type { UseDataFunctionReturn } from "@remix-run/react";

export default function PackageRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <main>
      <h1>Let's locate your package</h1>
      <Suspense
        fallback={<p>Loading package location...</p>}
      >
        <Deferred
          value={data.packageLocation}
          errorElement={
            <p>Error loading package location!</p>
          }
        >
          <PackageLocation />
        </Deferred>
      </Suspense>
    </main>
  );
}

function PackageLocation() {
  const packageLocation =
    useDeferredData<
      UseDataFunctionReturn<
        typeof loader
      >["packageLocation"]
    >();

  return (
    <p>
      Your package is at {packageLocation.latitude} lat and{" "}
      {packageLocation.longitude} long.
    </p>
  );
}
```

</details>

## Evaluating the solution

So rather than waiting for the whole `document -> JavaScript -> hydrate -> request` cycle, with streaming we start the request for the slow data as soon as the document request comes in. This can significantly speed up the user experience.

Additionally, the API that Remix exposes for this is extremely ergonomic. You can literally switch between whether something is going to be deferred or not based on whether you include the `await` keyword:

```tsx
return deferred({
  // not deferred:
  packageLocation: await packageLocationPromise,
  // deferred:
  packageLocation: packageLocationPromise,
});
```

Because of this, you can A/B test deferring, or even determine whether to defer based on the user or data being requested:

```tsx
export async function loader({
  request,
  params,
}: LoaderArgs) {
  const packageLocationPromise = getPackageLocation(
    params.packageId
  );
  const shouldDefer = await shouldDeferPackageLocation(
    request,
    params.packageId
  );

  return deferred({
    packageLocation: shouldDefer
      ? packageLocationPromise
      : await packageLocationPromise,
  });
}
```

That `shouldDeferPackageLocation` could be implemented to check the user making the request, whether the package location data is in a cache, the status of an A/B test, or whatever else you want. This is pretty sweet 🍭

Also, because this happens at request time (even on client transitions), makes use of the URL via nested routing (rather than requiring you to render before you know what data to fetch), and it's all just regular HTTP, we can prefetch and cache the response! Meaning client-side transitions can be _much_ faster (in fact, there are plenty of situations when the user may never be presented with the fallback at all).

Another powerful thing that's not immediately recognizable is if your server can finish loading deferred data before the client can load the javascript and hydrate, the server will stream down the HTML and "pop" it into place before react is even on the page, increasing performance for those on slow networks.

## FAQ

### Why not defer everything by default?

The Remix defer API is another lever Remix offers to give you a nice way to choose between trade-offs. Do you want a better TTFB (Time to first byte)? Defer stuff. Do you want a low CLS (Content Layout Shift)? Don't defer stuff. You want a better TTFB, but also want a lower CLS? Defer just the slow and unimportant stuff.

It's all trade-offs, and what's neat about the API design is that it's well suited for you to do easy experimentation to see which trade-offs lead to better results for your real-world key indicators.

### When does the fallback render?

The `<Deferred />` `fallbackElement` prop only renders on the initial render of the `<Deferred />` component. It will not render the fallback if props change. Effectively, this means that you will not get a fallback rendered when a user submits a form and loader data is revalidated and you will not get a fallback rendered when the user navigates to the same route with different params (in the context of our above example, if the user selects from a list of packages on the left to find their location on the right).

This may feel counter-intuitive at first, but stay with us, we really thought this through and it's important that it works this way. Let's imagine a world without the deferred API. For those scenarios you're probably going to want to implement Optimistic UI for form submissions/revalidation and some Pending UI for sibling route navigations.

When you decide you'd like to try the trade-offs of `deferred`, we don't want you to have to change or remove those optimizations because we want you to be able to easily switch between deferring some data and not deferring it. So we ensure that your existing pending states work the same way. If we didn't do this, then you could experience what we call "Popcorn UI" where submissions of data trigger the fallback loading state instead of the optimistic UI you'd worked hard on.

So just keep this in mind: **Deferred is 100% only about the initial load of a route.** And that applies the same way whether that load is a server render or a client transition.

[link]: ../api/remix#link
[usefetcher]: ../api/remix#usefetcher
[deferred-response]: ../api/remix#deferred-response
[deferred]: ../api/remix#deferred
[usedeferreddata]: ../api/remix#usedeferreddata
[react-lazy]: https://reactjs.org/docs/code-splitting.html#reactlazy
