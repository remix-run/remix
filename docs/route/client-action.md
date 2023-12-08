---
title: clientAction
---

# `clientAction`

In addition to (or in place of) your [`action`][action], you may define a `clientAction` function that will execute on the client.

Each route can define a `clientAction` function that handles mutations:

```tsx
export const clientAction = async ({
  request,
  params,
  serverAction,
}: ClientActionFunctionArgs) => {
  invalidateClientSideCache();
  const data = await serverAction();
  return data;
};
```

This function is only ever run on the client, and can be used in a few ways:

- Instead of a server `action` for full-client routes
- To use alongside a `clientLoader` cache by invalidating the cache on mutations
- To facilitate a migration from React Router

## Arguments

### `params`

This function receives the same [`params`][action-params] argument as an [`action`][action].

### `request`

This function receives the same [`request`][action-request] argument as an [`action`][action].

### `serverAction`

`serverAction` is an asynchronous function that makes the [fetch][fetch] call to the server `action` for this route.

See also:

- [Client Data Guide][client-data-guide]
- [clientLoader][clientloader]

[action]: ./action
[action-params]: ./loader#params
[action-request]: ./loader#request
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[client-data-guide]: ../guides/client-data
[clientloader]: ./client-loader
