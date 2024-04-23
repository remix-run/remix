---
title: Single Fetch
---

# Single Fetch

Remix introduced support for "Single Fetch" ([RFC][rfc]) behind the [`future.unstable_singleFetch`][future-flags] flag in [`v2.9.0`][2.9.0] which allows you to opt-into this behavior which will become the default in Remix v3.

## Overview

When you enable Single Fetch, Remix will make a single HTTP call to your server on client-side transitions, instead of multiple HTTP calls in parallel (one per loader). If you are currently returning `Response` instances from your loaders (i.e., `json`/`defer`) then you shouldn't _need_ to make many changes to your app code, but please read through the "breaking" changes below to be aware of some of the underlying behavior changes - specifically around serialization and status/header behavior.

### Breaking Changes

- Single fetch uses a new streaming format under the hood via [`turbo-stream`][turbo-stream], which means that we can stream down more complex data than just JSON
- Naked objects returned from `loader` and `action` functions are no longer automatically converted into a JSON `Response` and are serialized as-is over the wire
- You must add `node_modules/@remix-run/react/future/single-fetch.d.ts` to the end of your `tsconfig.json`'s `include` array to get proper type inference
- Revalidation after an `action` `4xx`/`5xx` `Response` is now opt-in, versus opt-out
- The [`headers`][headers] function is no longer used when Single Fetch is enabled, in favor of the new `response` stub passed to your `loader`/`action` functions

## Details

### Streaming Data Format

Previously, Remix used `JSON.stringify` to serialize your loader/action data over the wire, and needed to implement a custom streaming format to support `defer` responses.

With Single Fetch, Remix now uses [`turbo-stream`][turbo-stream] under the hood which provides first class support for streaming and allows you to automatically serialize/deserialize more complex data than JSON. The following data types can be streamed down directly via `turbo-stream`: `BigInt`, `Date`, `Error`, `Map`, `Promise`, `RegExp`, `Set`, `Symbol`, and `URL`. Subtypes of `Error` are also supported as long as they have a globally available constructor on the client (`SyntaxError`, `TypeError`, etc.).

This may or may not require any changes to your code once enabling Single Fetch:

- ✅ `json` responses returned from `loader`/`action` functions will still be serialized via `JSON.stringify` so if you return a `Date`, you'll receive a `string` from `useLoaderData`/`useActionData`
- ⚠️ If you're returning a `defer` instance or a naked object, it will now be serialized via `turbo-stream`, so if you return a `Date`, you'll receive a `Date` from `useLoaderData`/`useActionData`
  - If you wish to maintain current behavior (excluding streaming `defer` responses), you may just wrap any existing naked object returns in `json`

This also means that you no longer need to use the `defer` utility to send `Promise` instances over the wire! You can include a `Promise` anywhere in a naked object and pick it up on `useLoaderData().whatever`. You can also nest `Promise`'s if needed - but beware of potential UX implications.

### React Rendering APIs

In order to maintain consistency between document and data requests, `turbo-stream` is also used as the format for sending down data in initial document requests. This means that once opted-into Single Fetch, your application can no longer use [`renderToString`][rendertostring] and must use a React streaming renderer API such as [`renderToPipeableStream`][rendertopipeablestream] or [`renderToReadableStream`][rendertoreadablestream]) in [`entry.server.tsx`][entry-server].

This does not mean you _have_ to stream down your HTTP response, you can still send the full document at once by leveraging the `onAllReady` option in `renderToPipeableStream`, or the `allReady` promise in `renderToReadableStream`.

On the client side, this also means that your need to wrap your client-side [`hydrateRoot`][hydrateroot] call in a [`startTransition`][starttransition] call because the streamed data will be coming down wrapped in a `Suspense` boundary.

### Streaming Timeout

Previously, Remix has a concept of an `ABORT_TIMEOUT` built-into the default [`entry.server.tsx`][entry-server] files which would terminate the React renderer, but it didn't do anything in particular to clean up any pending deferred promises.

Now that Remix is streaming internally, we can cancel the `turbo-stream` processing and automatically reject any pending promises and stream up those errors to the client. By default, this happens after 4950ms - a value that was chosen to be just under the current 5000ms `ABORT_DELAY` in most entry.server.tsx files - since we need to cancel the promises and let the rejections stream up through the React renderer prior to aborting the React sid eof things.

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

### Type Inference

Without Single Fetch, any plain Javascript object returned from a `loader` or `action` is automatically serialized into a JSON response (as if you returned it via `json`). The type inference assumes this is the case and infer naked object returns as if they were JSON serialized.

With Single Fetch, naked objects will be streamed directly, so the built-in type inference is no longer accurate once you have opted-into Single Fetch. For example, they would assume that a `Date` would be serialized to a string on the client 😕.

In order to ensure you get the proper types when using Single Fetch, we've included a set of type overrides that you can include in your `tsconfig.json` which aligns the types with the Single Fetch behavior:

```json
{
  "include": [
    // ...
    "node_modules/@remix-run/react/future/single-fetch.d.ts"
  ]
}
```

**`useLoaderData`, `useActionData`, `useRouteLoaderData`, and `useFetcher`**

These methods do not require any code changes on your part - adding the single fetch types will cause their generics to deserialize correctly:

```ts
export async function loader() {
  const data = await fetchSomeData();
  return {
    message: data.message, // <- string
    date: data.date, // <- Date
  };
}

export default function Component() {
  // ❌ Before opting into single fetch types, types are serialized via JSON.stringify
  const data = useLoaderData<typeof loader>();
  //    ^? { message: string, date: string }

  // ✅ After opting into single fetch types, types are serialized via turbo-stream
  const data = useLoaderData<typeof loader>;
  //    ^? { message: string, date: Date }
}
```

**`useMatches`**

`useMatches` requires a manual cast to specify the loader type in order to get proper type inference on a given `match.data`. When using Single Fetch, you will need to replace the `UIMatch` type with `UIMatch_SingleFetch`:

```diff
  let matches = useMatches();
- let rootMatch = matches[0] as UIMatch<typeof loader>;
+ let rootMatch = matches[0] as UIMatch_SingleFetch<typeof loader>;
```

**`meta` Function**

`meta` functions also require a generic to indicate the current and ancestor route loader types in order to properly type the `data` and `matches` parameters. When using Single Fetch, you will need to replace the `MetaArgs` type with `MetaArgs_SingleFetch`:

```diff
  export function meta({
    data,
    matches,
- }: MetaArgs<typeof loader, { root: typeof rootLoader }>) {
+ }: MetaArgs_SingleFetch<typeof loader, { root: typeof rootLoader }>) {
    // ...
  }
```

### Revalidations

Previously, Remix would always revalidate all active loaders after _any_ action submission, regardless of the result of the action. You could opt-out of revalidation on a per-route basis via [`shouldRevalidate`][should-revalidate].

With Single Fetch, if an `action` returns or throws a `Response` with a `4xx/5xx` status code, Remix will _not revalidate_ loaders by default. If an `action` returns or throws anything that is not a 4xx/5xx Response, then the revalidation behavior is unchanged. The reasoning here is that in most cases, if you return a `4xx`/`5xx` Response, you didn't actually mutate any data so there is no need to reload data.

If you _want_ to continue revalidating one or more loaders after a 4xx/5xx action response, you can opt-into revalidation on a per-route basis by returning `true` from your [`shouldRevalidate`][should-revalidate] function. There is also a new `unstable_actionStatus` parameter passed to the function that you can use if you need to decide based on the action status code.

Revalidation is handled via a `?_routes` query string parameter on the single fetch HTTP call which limits the loaders being called. This means that when you are doing fine-grained revalidation, you will have cache enumerations based on the routes being requested - but all of the information is in the URL so you should not need any special CDN configurations (as opposed to if this was done via a custom header that required your CDN to respect the `Vary` header).

### Headers

The [`headers`][headers] function is no longer used when Single Fetch is enabled.
Instead, your `loader`/`action` functions now receive a mutable `ResponseStub` unique to that execution:

- To alter the status of your HTTP Response, set the `status` field directly:
  - `response.status = 201`
- To set the headers on your HTTP Response, use the standard [`Headers`][mdn-headers] APIs:
  - `response.headers.set(name, value)`
  - `response.headers.append(name, value)`
  - `response.headers.delete(name)`

```ts
type ResponseStub = {
  status: number | undefined;
  headers: Headers;
};

export async function action({
  request,
  response,
}: {
  request: Request;
  response?: ResponseStub;
}) {
  if (!loggedIn(request)) {
    response.status = 401;
    response.headers.append("Set-Cookie", "foo=bar");
    return { message: "Invalid Submission! " };
  }
  await addItemToDb(request);
  return null;
}
```

You can also throw these response stubs to short circuit the flow of your loaders and actions:

```tsx
export async function loader({ request, response }) {
  if (shouldRedirectToHome(request)) {
    response.status = 302;
    response.headers.set("Location", "/");
    throw response;
  }
  // ...
}
```

Each `loader`/`action` receives it's own unique `response` instance so you cannot see what other `loader`/`action` functions have set (which would be subject to race conditions). The resulting HTTP Response status and headers are determined as follows:

- Status Code
  - If all status codes are unset or have values <300, the deepest status code will be used for the HTTP response
  - If any status codes are set to a value >=300, the shallowest >=300 value will be used for the HTTP Response
- Headers
  - Remix tracks header operations and will replay them on a fresh `Headers` instance after all handlers have completed
  - These are replayed in order - action first (if present) followed by loaders in top-down order
  - `headers.set` on any child handler will overwrite values from parent handlers
  - `headers.append` can be used to set the same header from both a parent and child handler
  - `headers.delete` can be used to delete a value set by a parent handler, but not a value set from a child handler

Because single fetch supports naked object returns, and you no longer need to return a `Response` instance to set status/headers, the `json`/`redirect`/`redirectDocument`/`defer` utilities are considered deprecated when using Single Fetch. You may still continue returning normal `Response` instances and they'll apply status codes in the same way as the `response` stub, and will apply all headers via `headers.set` - overwriting any same-named header values from parents. If you need to append a header, you will need to switch from returning a `Response` instance to using the new `response` parameter.

### Client Loaders

If your app has route using [`clientLoader`][client-loader] functions, it's important to note that the behavior of Single Fetch will change slightly. Because `clientLoader` is intended to give you a way to opt-out of calling the server `loader` function - it would be incorrect for the Single Fetch call to execute that server loader. But we run all loaders in parallel and we don't want to _wait_ to make the call until we know which `clientLoader`'s are actually asking for server data.

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

[future-flags]: ../file-conventions/remix-config#future
[should-revalidate]: ../route/should-revalidate
[entry-server]: ../file-conventions/entry.server
[client-loader]: ../route/client-loader
[2.9.0]: https://github.com/remix-run/remix/blob/main/CHANGELOG.md#v290
[rfc]: https://github.com/remix-run/remix/discussions/7640
[turbo-stream]: https://github.com/jacob-ebey/turbo-stream
[rendertopipeablestream]: https://react.dev/reference/react-dom/server/renderToPipeableStream
[rendertoreadablestream]: https://react.dev/reference/react-dom/server/renderToReadableStream
[rendertostring]: https://react.dev/reference/react-dom/server/renderToString
[hydrateroot]: https://react.dev/reference/react-dom/client/hydrateRoot
[starttransition]: https://react.dev/reference/react/startTransition
[headers]: ../route/headers
[mdn-headers]: https://developer.mozilla.org/en-US/docs/Web/API/Headers
