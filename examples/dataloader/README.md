# DataLoader

This example shows how to avoid redundant roundtrips to data sources via batching and caching, implemented with [DataLoader](https://github.com/graphql/dataloader). This comes in handy when there are multiple nested routes that depend on the same data source.

Note that in many cases, you can meet the same requirement with Remix's own [useMatches](https://remix.run/docs/en/v1/api/remix#usematches) which lets you use all of your parent-routes' data in child routes. If that suits your use case, using `useMatches` is preferable. There are cases where this might not be the best fit though, including:

- You can't be sure if a parent did already request a particular piece of data
- You don't want your data loading to be tightly coupled with your parent routes, for architectural reasons

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/dataloader)

## Example

`app/data.server.ts` implements the `db` object which mimics an ORM in the style of [Prisma](https://www.prisma.io/). The method `db.user#findMany` logs _user#findMany_ to the console, for demo purposes.

There's exactly one DataLoader factory `createUsersByIdLoader`, implemented in `app/loaders/userLoader.ts`. It's put on context of [createRequestHandler](https://remix.run/docs/en/v1/other-api/adapter#createrequesthandler) in `server/index.ts` as `usersById` which is made available to all Remix-loaders and -actions. Both the loaders of `app/routes/users.tsx` and `app/routes/users/index.tsx` make calls to this loader. When inspecting the server logs while refreshing the page, you'll notice that there's only one log _user#findMany_ per request, proving that with this implementation, there's only one rountrip to the database.

## Related Links

- [DataLoader docs](https://github.com/graphql/dataloader)
- [DataLoader – Source code walkthrough [video]](https://youtu.be/OQTnXNCDywA), for those interested
- Remix docs: [useMatches](https://remix.run/docs/en/v1/api/remix#usematches)
