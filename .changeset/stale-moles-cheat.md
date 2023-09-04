---
"@remix-run/react": minor
---

Make `RouteMatch` a generic type

Now the `RouteMatch` type is a generic type that supports type inference. So just as you can do `useLoaderData<typeof loader>()`, now you can also do `RouteMatch<typeof loader>`.
