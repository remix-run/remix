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

          responseHeaders.set("Content-Type", "text/html");

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

With just that in place, you're unlikely to see any significant performance improvement. But with that alone you can now use [`React.lazy`][react-lazy] for components that can't server-render 🎉

### Using `deferred`

With React streaming setup, now you can start adding `Deferred` usage for your slow data requests you'd rather render a fallback UI. Let's do that for our example above:

```tsx lines=[3,5,10,17,21,32-45]
import type {
  LoaderFunction,
  Deferrable,
} from "@remix-run/node";
import { deferred } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getPackageLocation } from "~/models/packages";

type LoaderData = {
  packageLocation: Deferrable<{
    latitude: number;
    longitude: number;
  }>;
};

export const loader: LoaderFunction = ({ params }) => {
  const packageLocationPromise = getPackageLocation(
    params.packageId
  );

  return deferred<LoaderData>({
    packageLocation: packageLocationPromise,
  });
};

export default function PackageRoute() {
  const data = useLoaderData() as LoaderData;

  return (
    <main>
      <h1>Let's locate your package</h1>
      <Deferred
        value={data.packageLocation}
        fallback={<p>Loading package location...</p>}
        errorBoundary={
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
    </main>
  );
}
```

<details>
  <summary>Alternatively, you can use the `useDeferredValue` hook:</summary>

If you're not jazzed about bringing back render props, you can use a hook, but you'll have to break things out into another component:

```tsx lines=[14,21]
export default function PackageRoute() {
  const data = useLoaderData() as LoaderData;

  return (
    <main>
      <h1>Let's locate your package</h1>
      <Deferred
        value={data.packageLocation}
        fallback={<p>Loading package location...</p>}
        errorBoundary={
          <p>Error loading package location!</p>
        }
      >
        <PackageLocation />
      </Deferred>
    </main>
  );
}

function PackageLocation() {
  const packageLocation = useDeferredValue();
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

Additionally, the API that Remix exposes for this is extremely ergonomic. You can literally switch between whether something is going to be derferred based on whether you include the `await` keyword:

```tsx
return deferred<LoaderData>({
  // not deferred:
  packageLocation: await packageLocationPromise,
  // deferred:
  packageLocation: packageLocationPromise,
});
```

Because of this, you can A/B test deferring, or even determine whether to defer based on the user or data being requested:

```tsx
export const loader: LoaderFunction = ({
  request,
  params,
}) => {
  const packageLocationPromise = getPackageLocation(
    params.packageId
  );
  const shouldDefer = await shouldDeferPackageLocation(
    request,
    params.packageId
  );

  return deferred<LoaderData>({
    packageLocation: shouldDefer
      ? packageLocationPromise
      : await packageLocationPromise,
  });
};
```

That `shouldDeferPackageLocation` could be implemented to check the user making the request, whether the package location data is in a cache, the status of an A/B test, or whatever else you want. This is pretty sweet 🍭

## When to not use streaming

TODO: Talk about no streaming on action reloads.

[link]: ../api/remix#link
[usefetcher]: ../api/remix#usefetcher
[deferred-response]: ../api/remix#deferred-response
[deferred]: ../api/remix#deferred
[usedeferreddata]: ../api/remix#usedeferreddata
[react-lazy]: https://reactjs.org/docs/code-splitting.html#reactlazy
