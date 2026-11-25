The router no longer races middleware and handlers against `request.signal`. It still stops running middleware and handlers once the request aborts, and `router.fetch()` still rejects with the abort reason, even if the work in progress fails with its own error, but only after that work settles. Previously `router.fetch()` and each middleware's `await next()` rejected the moment the request aborted, while the handler kept running in the background. Middleware cleanup that runs when `next()` rejects, such as rolling back a transaction, now runs after the handler finishes. Responses that arrive after the request aborted still have their bodies cancelled. Requests through async handlers and middleware are about a third faster because the router no longer adds an abort listener to async requests or wraps each async layer in another promise.

Work that should stop when the client disconnects needs the signal passed to it:

```diff
  router.get(routes.search, async ({ request, url }) => {
-   let results = await fetch(searchApi(url))
+   let results = await fetch(searchApi(url), { signal: request.signal })
    return Response.json(await results.json())
  })
```

See the [decision doc](https://github.com/remix-run/remix/blob/main/decisions/011-cooperative-request-aborts.md) for the reasoning.
