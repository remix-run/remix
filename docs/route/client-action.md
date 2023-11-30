---
title: clientAction
---

# `clientAction`

In addition to (or in place of) your [`action`][action], you may define a `clientAction` function that will execute on the client.

Each route can define a "clientAction" function that handles mutations from the client.

```tsx
export const clientAction = async ({
  serverAction,
}: ClientActionFunctionArgs) => {
  invalidateClientSideCache();
  const data = await serverAction();
  return data;
};
```

## Arguments

### `params`

This function receives the same [`params`][action-params] argument as a [`action`][action].

### `request`

This function receives the same [`request`][action-request] argument as a [`action`][action].

### `serverAction`

`serverAction` is an asynchronous function that makes the [fetch][fetch] call to the server `action` for this route.

[action]: ./action
[action-params]: ./loader#params
[action-request]: ./loader#request
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
