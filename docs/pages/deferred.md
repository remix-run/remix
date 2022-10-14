---
title: Deferred Details
---

# What the heck is this?

Remix's "deferred" functionality is a concept that touches many parts of your stack, so I feel it's important to go into detail on what the goal of deferred is, exactly how it is implemented, limitations, and the the best use-cases of this technology.

## The Goal

The goal of deferred is to give you an easy way to make tradeoffs between your time-to-first-byte (TTFB) / page transition delay and the completeness of your users first page view.

## `json()` Loaders

Let's start with understanding how Remix handles your standard `return { hello: "world" };` and `return json({ hello: "world" })` responses.

### Document Requests

When a document request happens, you can think of Remix as doing a handful of things for you:

1. Matches your routes
1. Executes loaders in parallel
1. Provides `<Scripts />` that
   1. Serializes results from your loaders to JSON
   1. Imports your `entry.client` script

The `<Scripts />` ends up looking something like this:

```html
<!-- A bunch of modulepreload's -->

<script async type="module">
  window.__remixContext = {
    routeData: {
      "routes/...": {
        hello: "world",
      },
    },
  };
  import("/build/entry.client-DaHa34.js");
</script>
```

`<RemixBrowser />` then reads `window.__remixContext` and restores the state for hydration. This is all a standard pattern when it comes to SSR'ing UI frameworks that hydrate on the client to deliver a more SAP like experience.

### Data Requests

After your application has hydrated in the browser and a `<Link>` is clicked or a `<Form>` is submitted, these are intercepted and browser behavior is emulated by remix.

The first step of this emulation is to query the server for the data of the route matches of the requested location. This is done by initializing concurrent `fetch()` request with a query param that includes the route ID we are requesting data for. This may look something like `?_data=routes/index`.

After all these requests resolve, the JSON data is decoded, stored in the remix context, and your app is re-rendered at the new location with the new matches and data. Again, all pretty standard.

## `defer()` Loaders

### Document Requests

Defer is cool because everything up to the `<Scripts />` above applies to deferred responses. Deferred differs in how the `window.__remixContext` is serialized.

We still serialize the same information, but after we have additional runtime that is generated for deferred promises keys. This includes but is not limited to:

1. Constructing a new promise per deferred promise key
2. Race this promise against a server timeout
3. Store for later resolution

This may look something like:

```html
<!-- A bunch of modulepreload's -->

<script async type="module">
  window.__remixContext = {
    routeData: {
      "routes/...": {
        hello: "world",
      },
    },
  };
  const ABORT_DELAY = 5000;
  // Use later by script streamed after promise resolution
  // or rejection on the sever
  window.__remixDeferredResolvers = {
    "routes/...": {},
  };
  // Create and store a promise in the loader data that
  // will be used for hydration
  let promise = new Promise((resolve, reject) => {
    window.__remixDeferredResolvers["routes/..."] = {
      resolve: (data) => {
        // Set the traced promise data
        promise._data = data;
        resolve(data);
      },
      reject: (error) => {
        // Set the traced promise error
        promise._error = error;
        reject(error);
      },
    };
  });
  // Race it against the server timeout
  promise = Promise.race([timer(ABORT_DELAY), promise]);

  // This is a tracked promise
  promise._tracked = true;
  window.__remixContext.routeData["routes/..."][
    "deferredKey"
  ] = promise;

  import("/build/entry.client-DaHa34.js");
</script>
```

After the promises resolution or rejection, the server then streams down both the rendered HTML to pop into place if react has not hydrated, and a script tag that is responsible for resolving / rejecting the tracked promise created above. This may look something like:

```html
<script>
  const data = "data resolved from the promise";
  window.__remixDeferredResolvers["routes/..."][
    "deferredKey"
  ].resolve(data);
</script>
```

or in the case of a rejection:

```html
<script>
  const error = new Error("...");
  error.stack = "...";
  window.__remixDeferredResolvers["routes/..."][
    "deferredKey"
  ].reject(error);
</script>
```

This allows for a successful render and hydration in the following cases:

1. Deferred resolves before react hydrates
1. Deferred resolves after react hydrates

In the case deferred resolves before react hydrates, React's out-of-order streaming takes care of the UI with their own inline scripts that pop the streamed HTML template in a hidden `<div>` into the proper location in the DOM. The promise is then resolved to no listeners, but the data / error is stored for later synchronous resolution in the re-render on the tracked promise.

In the case React hydrates before the deferred promise resolves, the promise is still pending, therefore we throw it so React remains in a suspended state until it does resolve. Once it resolves, the data / error is accessible synchronously in the subsequent re-render.

### Data Requests

`defer()` loader responses differ quite a bit from their `json()` counterpart when it comes to data requests. The most notable difference is you are no longer sending an `application/json` content type response, but rather a `text/remix-deferred` response.

A high level overview of the content type is as follows:

1. An initial critical payload of JSON serialized data with promise key values replaced by their key prefixed with `__deferred_promise:`
2. `\n\n` delimited chunks beginning with either `data:` or `error:` followed by JSON serialized data

This may look like:

```plaintext
{
  "critical": "data",
  "deferredKey1": "__deferred_promise:deferredKey1",
  "deferredKey2": "__deferred_promise:deferredKey2"
}

data:{
  "deferredKey1": "value 1"
}

error:{
  "deferredKey2": {"message": "...", "stack": "..." }
}
```

When the browser receives the initial critical data payload with the encoded deferred keys, your route is considered "loaded".

At this point we have stored a pending promise for each deferred key in the response that will be resolved as their subsequent "data" or "error" payloads are streamed.

## Limitations

### Not usable everywhere

The underlying implementation assumes that your hosting provider is capable of streaming individual chunks. This isn't a problem if you are hosting bare metal, or on a VM provider, but some serverless platforms such as AWS at the time of writing required buffered responses.

### JS Event changes

The biggest drawback of `defer()`, but arguably the reason for it's existence is that it keeps the connection between the browser and server open until your slowest piece of data is resolved.

This means that your HTML document isn't considered loaded until the slowest piece is resolved and your application is potentially fully hydrated, i.e `document.addEventListener("load", () => {})` isn't fired until the connection is closed.

## Use Cases

The best use-cases for `defer()` involve "below the fold" or initial out of view data. As you've seen above, `defer()` isn't about continuous streaming of data, but rather delayed (deferred if you prefer 😉) data. This yields itself well to cases such as:

- Content inside a `<details>` tag
- Options in a `<select>` tag
- Extra product details from a CMS
- Comment sections

In general, cases where data isn't initially viewable but usable without the application being hydrated.


## Summary

Obviously this is a very high level overview as we didn't dive into how form submissions, revalidations, or cancellations are handled, but I hope it is enough to help you decide if `defer()` is right for your use-case.

PS. Don't forget about `useFetcher()` and resource routes for data that is behind user-interactions that require your application to be hydrated.