---
title: 0003 - Deferred API
---

# Deferred API

Date: 2022-06-29

Status: accepted | open to change

## Context

With React 18 landing, we are looking to take full advantage of the out-of-order streaming renderers and selective hydration without introducing a huge new API surface or requiring fundamental architectural changes for existing apps to leverage the new functionality.

## Decision

### Behavior

The `<Deferred />` fallbackElement prop only renders on the initial render of the `<Deferred />` component. It will not render the fallback if props change. Effectively, this means that you will not get a fallback rendered when a user submits a form and loader data is revalidated and you will not get a fallback rendered when the user navigates to the same route with different params.

This may feel counter-intuitive at first, but stay with us, we really thought this through and it's important that it works this way. Let's imagine a world without the deferred API. For those scenarios you're probably going to want to implement Optimistic UI for form submissions/revalidation and some Pending UI for sibling route navigations.

When you decide you'd like to try the trade-offs of deferred, we don't want you to have to change or remove those optimizations because we want you to be able to easily switch between deferring some data and not deferring it. So we ensure that your existing pending states work the same way. If we didn't do this, then you could experience what we call "Popcorn UI" where submissions of data trigger the fallback loading state instead of the optimistic UI you'd worked hard on.

So just keep this in mind: Deferred is 100% only about the initial load of a route. And that applies the same way whether that load is a server render or a client transition.

### Server API:

Introduces a new response helper called `deferred()` that's similar to the existing `json()` function. `deferred()` allows you to return an object / array with Promises as entries. This will ultimately return a `Response` that sends the critical data (non-promise entries), then as the promises resolve, streams the results or errors.

#### **deferred(result, init)**

Definition:

```ts
export type DeferredFunction = <Data extends unknown = unknown>(
  data: Data,
  init?: number | ResponseInit
) => DeferredResponse<Data>;
```

Params:

- `result` | `Data`: The object / array to be sent to the client, can include promises as values.
- `init` | `number | ResponseInit`: Optional status code / init object to pass to the `Response` constructor.

### React API:

Introduce a new `<Deferred>` component that will resolve the values of the `deferred()` Promises accessed from `useLoaderData()`. This can be thought of as a thin wrapper around `<React.Suspense>` that is responsible for resolving the Promises and rendering the fallback / error states.

## Consequences

With this API we have not introduced a way to build "popcorn" UIs. This is not necessarily a good thing on it's own, but is a powerful leaver to tune your CLS vs TTFB tradeoffs without making fundamental architectural changes to your code.
