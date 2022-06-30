---
title: 0003 - Deferred API
---

# Deferred API

Date: 2022-06-29

Status: accepted | open to change

## Context

With React 18 landing, we are looking to take full advantage of the out-of-order streaming renderers and selective hydration without introducing a huge surface API or requiring fundamental architectural changes for existing apps to leverage the new functionality.

## Decision

### Server API:

Introduces a new response helper called `deferred()` that's similar to the existing `json()` function. `deferred()` allows you to return an object with Promises as entries. This will ultimately return a `Response` that sends the critical data (non-promise entries), then as the promises resolve, streams the results or errors.

#### **deferred(result, init)**

Definition:

```ts
function deferred
```

Params:

- `result` | `Data`: The object to be sent to the client.

### React API:

Introduce a new `<Deferred>` component that will resolve the values of the `deferred()` Promises accessed from `useLoaderData()`. Deferred

## Consequences

Loaders always receive a null body for the request.

If you are reading the request body in both an action and handleDocumentRequest or handleDataRequest this will now fail as the body will have already been read. If you wish to continue reading the request body in multiple places for a single request against recommendations, consider using `.clone()` before reading it; just know this comes with tradeoffs.
