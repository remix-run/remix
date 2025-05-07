---
title: Single Fetch
---

# Single Fetch

Single Fetch is a new data loading strategy and streaming format. When you enable Single Fetch, Remix will make a single HTTP call to your server on client-side transitions, instead of multiple HTTP calls in parallel (one per loader). Additionally, Single Fetch also allows you to send down naked objects from your `loader` and `action`, such as `Date`, `Error`, `Promise`, `RegExp`, and more.

## Overview

Remix introduced support for "Single Fetch" ([RFC][rfc]) behind the [`future.unstable_singleFetch`][future-flags] flag in [`v2.9.0`][2.9.0] (later stabilized as `future.v3_singleFetch` in [`v2.13.0`][2.13.0]) which allows you to opt-into this behavior. Single Fetch will be the default in [React Router v7][merging-remix-and-rr].

Enabling Single Fetch is intended to be low-effort up-front, and then allow you to adopt all breaking changes iteratively over time. You can start by applying the minimal required changes to [enable Single Fetch][start], then use the [migration guide][migration-guide] to make incremental changes in your application to ensure a smooth, non-breaking upgrade to [React Router v7][merging-remix-and-rr].

Please also review the [Breaking Changes][breaking-changes] so you can be aware of some of the underlying behavior changes, specifically around serialization and status/header behavior.

## Enabling Single Fetch

**1. Enable the future flag**

```ts filename=vite.config.ts lines=[6]
export default defineConfig({
  plugins: [
    remix({
      future: {
        // ...
        v3_singleFetch: true,
      },
    }),
    // ...
  ],
});
```

**2. Deprecated `fetch` polyfill**

Single Fetch requires using [`undici`][undici] as your `fetch` polyfill, or using the built-in `fetch` on Node 20+, because it relies on APIs available there that are not in the `@remix-run/web-fetch` polyfill. Please refer to the [Undici][undici-polyfill] section in the 2.9.0 release notes below for more details.

- If you are using Node 20+, remove any calls to `installGlobals()` and use Node's built-in `fetch` (this is the same thing as `undici`).

- If you are managing your own server and calling `installGlobals()`, you will need to call `installGlobals({ nativeFetch: true })` to use `undici`.

  ```diff
  - installGlobals();
  + installGlobals({ nativeFetch: true });
  ```

- If you are using `remix-serve`, it will use `undici` automatically if Single Fetch is enabled.

- If you are using miniflare/cloudflare worker with your remix project, ensure your [compatibility flag][compatibility-flag] is set to `2023-03-01` or later as well.

**3. Adjust `headers` implementations (if necessary)**

With Single Fetch enabled, there will now only be one request made on client-side navigations even when multiple loaders need to run. To handle merging headers for the handlers called, the [`headers`][headers] export will now also apply to `loader`/`action` data requests. In many cases, the logic you already have in there for document requests should be close to sufficient for your new Single Fetch data requests.

```diff
-import { json } from "@remix-run/node";
+import { data } from "@remix-run/node";

// This example assumes you already have a headers function to handle header
// merging for your document requests
export function headers() {
  // ...
}

export async function loader({}: LoaderFunctionArgs) {
  let tasks = await fetchTasks();
-  return json(tasks, {
+  return data(tasks, {
    headers: {
      "Cache-Control": "public, max-age=604800"
    }
  });
}
```

⚠️ This is especially important to review for caching behaviors. Prior to Single Fetch, a given loader could choose it's own cache duration and it would apply to the singular HTTP response from that loader. But document requests would call multiple loaders and required an application to implement the `headers` method to intelligently merge headers returned from loaders across multiple routes. With Single fetch, document and data requests now behave the same so your `headers` function needs to return the proper headers/caching behavior for _all_ routes.

**4. Add a `nonce` (if you are using a CSP)**

If you have a [content security policy for scripts][csp] with [nonce-sources][csp-nonce], you will need to add that `nonce` to two places for the streaming Single Fetch implementation:

- `<RemixServer nonce={yourNonceValue}>` - this will add the `nonce` to the inline scripts rendered by this component that handle the streaming data on the client side
- In your `entry.server.tsx` in the `options.nonce` parameter to [`renderToPipeableStream`][rendertopipeablestream]/[`renderToReadableStream`][rendertoreadablestream]. See also the Remix [Streaming docs][streaming-nonce]

**5. Replace `renderToString` (if you are using it)**

For most Remix apps it's unlikely you're using `renderToString`, but if you have opted into using it in your `entry.server.tsx`, then continue reading, otherwise you can skip this step.

In order to maintain consistency between document and data requests, `turbo-stream` is also used as the format for sending down data in initial document requests. This means that once opted-into Single Fetch, your application can no longer use [`renderToString`][rendertostring] and must use a React streaming renderer API such as [`renderToPipeableStream`][rendertopipeablestream] or [`renderToReadableStream`][rendertoreadablestream]) in [`entry.server.tsx`][entry-server].

This does not mean you _have_ to stream down your HTTP response, you can still send the full document at once by leveraging the `onAllReady` option in `renderToPipeableStream`, or the `allReady` promise in `renderToReadableStream`.

On the client side, this also means that your need to wrap your client-side [`hydrateRoot`][hydrateroot] call in a [`startTransition`][starttransition] call because the streamed data will be coming down wrapped in a `Suspense` boundary.

## Breaking Changes

There are a handful of breaking changes introduced with Single Fetch - some of which you need to handle up-front when you enable the flag, and some you can handle incrementally after enabling the flag. You will need to ensure all of these have been handled prior to updating to the next major version.

**Changes that need to be addressed up front:**

- **Deprecated `fetch` polyfill**: The old `installGlobals()` polyfill doesn't work for Single Fetch, you must either use the native Node 20 `fetch` API or call `installGlobals({ nativeFetch: true })` in your custom server to get the [undici-based polyfill][undici-polyfill]
- **`headers` export applied to data requests**: The [`headers`][headers] function will now apply to both document and data requests

**Changes to be aware of that you may need to handle over-time:**

- **[New streaming Data format][streaming-format]**: Single fetch uses a new streaming format under the hood via [`turbo-stream`][turbo-stream], which means that we can stream down more complex data than just JSON
- **No more auto-serialization**: Naked objects returned from `loader` and `action` functions are no longer automatically converted into a JSON `Response` and are serialized as-is over the wire
- [**Updates to type inference**][type-inference-section]: To get the most accurate type inference, you should [augment][augment] Remix's `Future` interface with `v3_singleFetch: true`
- [**Default revalidation behavior changes to opt-out on GET navigations**][revalidation]: Default revalidation behavior on normal navigations changes from opt-in to opt-out and your server loaders will re-run by default
- [**Opt-in `action` revalidation**][action-revalidation]: Revalidation after an `action` `4xx`/`5xx` `Response` is now opt-in, versus opt-out

## Adding a New Route with Single Fetch

With Single Fetch enabled, you can go ahead and author routes that take advantage of the more powerful streaming format.

<docs-info>In order to get proper type inference, you need to [augment][augment] Remix's `Future` interface with `v3_singleFetch: true`. You can read more about this in the [Type Inference section][type-inference-section].</docs-info>

With Single Fetch you can return the following data types from your loader: `BigInt`, `Date`, `Error`, `Map`, `Promise`, `RegExp`, `Set`, `Symbol`, and `URL`.

```tsx
// routes/blog.$slug.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({
  params,
}: LoaderFunctionArgs) {
  const { slug } = params;

  const comments = fetchComments(slug);
  const blogData = await fetchBlogData(slug);

  return {
    content: blogData.content, // <- string
    published: blogData.date, // <- Date
    comments, // <- Promise
  };
}

export default function BlogPost() {
  const blogData = useLoaderData<typeof loader>();
  //    ^? { content: string, published: Date, comments: Promise }

  return (
    <>
      <Header published={blogData.date} />
      <BlogContent content={blogData.content} />
      <Suspense fallback={<CommentsSkeleton />}>
        <Await resolve={blogData.comments}>
          {(comments) => (
            <BlogComments comments={comments} />
          )}
        </Await>
      </Suspense>
    </>
  );
}
```

## Migrating a Route with Single Fetch

If you are currently returning `Response` instances from your loaders (i.e., `json`/`defer`) then you shouldn't _need_ to make many changes to your app code to take advantage of Single Fetch.

However, to better prepare your upgrade to [React Router v7][merging-remix-and-rr] in the future, we recommend that you start making the following changes on a route-by-route basis, as that is the easiest way to validate that updating the headers and data types doesn't break anything.

### Type Inference

Without Single Fetch, any plain Javascript object returned from a `loader` or `action` is automatically serialized into a JSON response (as if you returned it via `json`). The type inference assumes this is the case and infers naked object returns as if they were JSON serialized.

With Single Fetch, naked objects will be streamed directly, so the built-in type inference is no longer accurate once you have opted-into Single Fetch. For example, they would assume that a `Date` would be serialized to a string on the client 😕.

#### Enable Single Fetch types

To switch over to Single Fetch types, you should [augment][augment] Remix's `Future` interface with `v3_singleFetch: true`.
You can do this in any file covered by your `tsconfig.json` > `include`.
We recommend you do this in your `vite.config.ts` to keep it colocated with the `future.v3_singleFetch` future flag in the Remix plugin:

```ts
declare module "@remix-run/server-runtime" {
  // or cloudflare, deno, etc.
  interface Future {
    v3_singleFetch: true;
  }
}
```

Now `useLoaderData`, `useActionData`, and any other utilities that use a `typeof loader` generic should be using Single Fetch types:

```ts
import { useLoaderData } from "@remix-run/react";

export function loader() {
  return {
    planet: "world",
    date: new Date(),
  };
}

export default function Component() {
  const data = useLoaderData<typeof loader>();
  //    ^? { planet: string, date: Date }
}
```

#### Functions and class instances

In general, functions cannot be reliably sent over the network, so they get serialized as `undefined`:

```ts
import { useLoaderData } from "@remix-run/react";

export function loader() {
  return {
    planet: "world",
    date: new Date(),
    notSoRandom: () => 7,
  };
}

export default function Component() {
  const data = useLoaderData<typeof loader>();
  //    ^? { planet: string, date: Date, notSoRandom: undefined }
}
```

Methods are also not serializable, so class instances get slimmed down to just their serializable properties:

```ts
import { useLoaderData } from "@remix-run/react";

class Dog {
  name: string;
  age: number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  bark() {
    console.log("woof");
  }
}

export function loader() {
  return {
    planet: "world",
    date: new Date(),
    spot: new Dog("Spot", 3),
  };
}

export default function Component() {
  const data = useLoaderData<typeof loader>();
  //    ^? { planet: string, date: Date, spot: { name: string, age: number, bark: undefined } }
}
```

#### `clientLoader` and `clientAction`

<docs-warning>Make sure to include types for the `clientLoader` args and `clientAction` args as that is how our types detect client data functions.</docs-warning>

Data from client-side loaders and actions are never serialized so types for those are preserved:

```ts
import {
  useLoaderData,
  type ClientLoaderFunctionArgs,
} from "@remix-run/react";

class Dog {
  /* ... */
}

// Make sure to annotate the types for the args! 👇
export function clientLoader(_: ClientLoaderFunctionArgs) {
  return {
    planet: "world",
    date: new Date(),
    notSoRandom: () => 7,
    spot: new Dog("Spot", 3),
  };
}

export default function Component() {
  const data = useLoaderData<typeof clientLoader>();
  //    ^? { planet: string, date: Date, notSoRandom: () => number, spot: Dog }
}
```

### Headers

The [`headers`][headers] function is now used on both document and data requests when Single Fetch is enabled. You should use that function to merge any headers returned from loaders executed in parallel, or to return any given `actionHeaders`.

### Returned Responses

With Single Fetch, you no longer need to return `Response` instances and can just return your data directly via naked object returns. Therefore, the `json`/`defer` utilities should be considered deprecated when using Single Fetch. These will remain for the duration of v2 so you don't need to remove them immediately. They will likely be removed in the next major version, so we recommend remove them incrementally between now and then.

For v2, you may still continue returning normal `Response` instances and their `status`/`headers` will take effect the same way they do on document requests (merging headers via the `headers()` function).

Over time, you should start eliminating returned Responses from your loaders and actions.

- If your `loader`/`action` was returning `json`/`defer` without setting any `status`/`headers`, then you can just remove the call to `json`/`defer` and return the data directly
- If your `loader`/`action` was returning custom `status`/`headers` via `json`/`defer`, you should switch those to use the new [`data()`][data-utility] utility.

### Client Loaders

If your app has routes using [`clientLoader`][client-loader] functions, it's important to note that the behavior of Single Fetch will change slightly. Because `clientLoader` is intended to give you a way to opt-out of calling the server `loader` function - it would be incorrect for the Single Fetch call to execute that server loader. But we run all loaders in parallel and we don't want to _wait_ to make the call until we know which `clientLoader`'s are actually asking for server data.

For example, consider the following `/a/b/c` routes:

```ts
// routes/a.tsx
export function loader() {
  return { data: "A" };
}

// routes/a.b.tsx
export function loader() {
  return { data: "B" };
}

// routes/a.b.c.tsx
export function loader() {
  return { data: "C" };
}

export function clientLoader({ serverLoader }) {
  await doSomeStuff();
  const data = await serverLoader();
  return { data };
}
```

If a user navigates from `/ -> /a/b/c`, then we need to run the server loaders for `a` and `b`, and the `clientLoader` for `c` - which may eventually (or may not) call it's own server `loader`. We can't decide to include the `c` server `loader` in a single fetch call when we want to fetch the `a`/`b` `loader`'s, nor can we delay until `c` actually makes the `serverLoader` call (or returns) without introducing a waterfall.

Therefore, when you export a `clientLoader` that route opts-out of Single Fetch and when you call `serverLoader` it will make a single fetch to get only it's route server `loader`. All routes that do not export a `clientLoader` will be fetched in a singular HTTP request.

So, on the above route setup a navigation from `/ -> /a/b/c` will result in a singular single-fetch call up front for routes `a` and `b`:

```
GET /a/b/c.data?_routes=routes/a,routes/b
```

And then when `c` calls `serverLoader`, it'll make it's own call for just the `c` server `loader`:

```
GET /a/b/c.data?_routes=routes/c
```

### Resource Routes

Because of the new [streaming format][streaming-format] used by Single Fetch, raw JavaScript objects returned from `loader` and `action` functions are no longer automatically converted to `Response` instances via the `json()` utility. Instead, in navigational data loads they're combined with the other loader data and streamed down in a `turbo-stream` response.

This poses an interesting conundrum for [resource routes][resource-routes] which are unique because they're intended to be hit individually -- and not always via Remix APIs. They can also be accessed via any other HTTP client (`fetch`, `cURL`, etc.).

If a resource route is intended for consumption by internal Remix APIs, we _want_ to be able to leverage the `turbo-stream` encoding to unlock the ability to stream down more complex structures such as `Date` and `Promise` instances. However, when accessed externally, we'd probably prefer to return the more easily consumable JSON structure. Thus, the behavior is slightly ambiguous if you return a raw object in v2 - should it be serialized via `turbo-stream` or `json()`?

To ease backwards-compatibility and ease the adoption of the Single Fetch future flag, Remix v2 will handle this based on whether it's accessed from a Remix API or externally. In the future Remix will require you to return your own [JSON response][returning-response] if you do not want raw objects to be streamed down for external consumption.

The Remix v2 behavior with Single Fetch enabled is as follows:

- When accessing from a Remix API such as `useFetcher`, raw Javascript objects will be returned as `turbo-stream` responses, just like normal loaders and actions (this is because `useFetcher` will append the `.data` suffix to the request)

- When accessing from an external tool such as `fetch` or `cURL`, we will continue this automatic conversion to `json()` for backwards-compatibility in v2:

  - Remix will log a deprecation warning when this situation is encountered
  - At your convenience, you can update impacted resource route handlers to return a `Response` object
  - Addressing these deprecation warnings will better prepare you for the eventual Remix v3 upgrade

  ```tsx filename=app/routes/resource.tsx bad
  export function loader() {
    return {
      message: "My externally-accessed resource route",
    };
  }
  ```

  ```tsx filename=app/routes/resource.tsx good
  export function loader() {
    return Response.json({
      message: "My externally-accessed resource route",
    });
  }
  ```

## Additional Details

### Streaming Data Format

Previously, Remix used `JSON.stringify` to serialize your loader/action data over the wire, and needed to implement a custom streaming format to support `defer` responses.

With Single Fetch, Remix now uses [`turbo-stream`][turbo-stream] under the hood which provides first class support for streaming and allows you to automatically serialize/deserialize more complex data than JSON. The following data types can be streamed down directly via `turbo-stream`: `BigInt`, `Date`, `Error`, `Map`, `Promise`, `RegExp`, `Set`, `Symbol`, and `URL`. Subtypes of `Error` are also supported as long as they have a globally available constructor on the client (`SyntaxError`, `TypeError`, etc.).

This may or may not require any immediate changes to your code once enabling Single Fetch:

- ✅ `json` responses returned from `loader`/`action` functions will still be serialized via `JSON.stringify` so if you return a `Date`, you'll receive a `string` from `useLoaderData`/`useActionData`
- ⚠️ If you're returning a `defer` instance or a naked object, it will now be serialized via `turbo-stream`, so if you return a `Date`, you'll receive a `Date` from `useLoaderData`/`useActionData`
  - If you wish to maintain current behavior (excluding streaming `defer` responses), you may just wrap any existing naked object returns in `json`

This also means that you no longer need to use the `defer` utility to send `Promise` instances over the wire! You can include a `Promise` anywhere in a naked object and pick it up on `useLoaderData().whatever`. You can also nest `Promise`'s if needed - but beware of potential UX implications.

Once adopting Single Fetch, it is recommended that you incrementally remove the usage of `json`/`defer` throughout your application in favor of returning raw objects.

### Streaming Timeout

Previously, Remix has a concept of an `ABORT_TIMEOUT` built-into the default [`entry.server.tsx`][entry-server] files which would terminate the React renderer, but it didn't do anything in particular to clean up any pending deferred promises.

Now that Remix is streaming internally, we can cancel the `turbo-stream` processing and automatically reject any pending promises and stream up those errors to the client. By default, this happens after 4950ms - a value that was chosen to be just under the current 5000ms `ABORT_DELAY` in most entry.server.tsx files - since we need to cancel the promises and let the rejections stream up through the React renderer prior to aborting the React side of things.

You can control this by exporting a `streamTimeout` numeric value from your `entry.server.tsx` and Remix will use that as the number of milliseconds after which to reject any outstanding Promises from `loader`/`action`'s. It's recommended to decouple this value from the timeout in which you abort the React renderer - and you should always set the React timeout to a higher value so it has time to stream down the underlying rejections from your `streamTimeout`.

```tsx filename=app/entry.server.tsx lines=[1-2,32-33]
// Reject all pending promises from handler functions after 5 seconds
export const streamTimeout = 5000;

// ...

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
        abortDelay={ABORT_DELAY}
      />,
      {
        onShellReady() {
          /* ... */
        },
        onShellError(error: unknown) {
          /* ... */
        },
        onError(error: unknown) {
          /* ... */
        },
      }
    );

    // Automatically timeout the react renderer after 10 seconds
    setTimeout(abort, 10000);
  });
}
```

### Revalidations

#### Normal Navigation Behavior

In addition to the simpler mental model and the alignment of document and data requests, another benefit of Single Fetch is simpler (and hopefully better) caching behavior. Generally, Single Fetch will make fewer HTTP requests and hopefully cache those results more frequently compared to the previous multiple-fetch behavior.

To reduce cache fragmentation, Single Fetch changes the default revalidation behavior on GET navigations. Previously, Remix would not re-run loaders for reused ancestor routes unless you opted-in via `shouldRevalidate`. Now, Remix _will_ re-run those by default in the simple case for a Single Fetch request like `GET /a/b/c.data`. If you do not have any `shouldRevalidate` or `clientLoader` functions, this will be the behavior for your app.

Adding either a `shouldRevalidate` or a `clientLoader` to any of the active routes will trigger granular Single Fetch calls that include a `_routes` parameter specifying the subset of routes to run.

If a `clientLoader` calls `serverLoader()` internally, that will trigger a separate HTTP call for that specific route, akin to the old behavior.

For example, if you are on `/a/b` and you navigate to `/a/b/c`:

- When no `shouldRevalidate` or `clientLoader` functions exist: `GET /a/b/c.data`
- If all routes have loaders but `routes/a` opts out via `shouldRevalidate`:
  - `GET /a/b/c.data?_routes=root,routes/b,routes/c`
- If all routes have loaders but `routes/b` has a `clientLoader`:
  - `GET /a/b/c.data?_routes=root,routes/a,routes/c`
  - And then if B's `clientLoader` calls `serverLoader()`:
    - `GET /a/b/c.data?_routes=routes/b`

If this new behavior is sub-optimal for your application, you should be able to opt-back into the old behavior of not-revalidating by adding a `shouldRevalidate` that returns `false` in the desired scenarios to your parent routes.

Another option is to leverage a server-side cache for expensive parent loader calculations.

#### Submission Revalidation Behavior

Previously, Remix would always revalidate all active loaders after _any_ action submission, regardless of the result of the action. You could opt-out of revalidation on a per-route basis via [`shouldRevalidate`][should-revalidate].

With Single Fetch, if an `action` returns or throws a `Response` with a `4xx/5xx` status code, Remix will _not revalidate_ loaders by default. If an `action` returns or throws anything that is not a 4xx/5xx Response, then the revalidation behavior is unchanged. The reasoning here is that in most cases, if you return a `4xx`/`5xx` Response, you didn't actually mutate any data so there is no need to reload data.

If you _want_ to continue revalidating one or more loaders after a 4xx/5xx action response, you can opt-into revalidation on a per-route basis by returning `true` from your [`shouldRevalidate`][should-revalidate] function. There is also a new `actionStatus` parameter passed to the function that you can use if you need to decide based on the action status code.

Revalidation is handled via a `?_routes` query string parameter on the single fetch HTTP call which limits the loaders being called. This means that when you are doing fine-grained revalidation, you will have cache enumerations based on the routes being requested - but all of the information is in the URL so you should not need any special CDN configurations (as opposed to if this was done via a custom header that required your CDN to respect the `Vary` header).

[future-flags]: ../file-conventions/remix-config#future
[should-revalidate]: ../route/should-revalidate
[entry-server]: ../file-conventions/entry.server
[client-loader]: ../route/client-loader
[2.9.0]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#v290
[2.13.0]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#v2130
[rfc]: https://github.com/remix-run/remix/discussions/7640
[turbo-stream]: https://github.com/jacob-ebey/turbo-stream
[rendertopipeablestream]: https://react.dev/reference/react-dom/server/renderToPipeableStream
[rendertoreadablestream]: https://react.dev/reference/react-dom/server/renderToReadableStream
[rendertostring]: https://react.dev/reference/react-dom/server/renderToString
[hydrateroot]: https://react.dev/reference/react-dom/client/hydrateRoot
[starttransition]: https://react.dev/reference/react/startTransition
[headers]: ../route/headers
[resource-routes]: ../guides/resource-routes
[returning-response]: ../route/loader#returning-response-instances
[streaming-format]: #streaming-data-format
[undici-polyfill]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#undici
[undici]: https://github.com/nodejs/undici
[csp]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src
[csp-nonce]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/Sources#sources
[merging-remix-and-rr]: https://remix.run/blog/merging-remix-and-react-router
[migration-guide]: #migrating-a-route-with-single-fetch
[breaking-changes]: #breaking-changes
[revalidation]: #normal-navigation-behavior
[action-revalidation]: #submission-revalidation-behavior
[start]: #enabling-single-fetch
[type-inference-section]: #type-inference
[compatibility-flag]: https://developers.cloudflare.com/workers/configuration/compatibility-dates
[data-utility]: ../utils/data
[augment]: https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
[streaming-nonce]: ./streaming#streaming-with-a-content-security-policy
