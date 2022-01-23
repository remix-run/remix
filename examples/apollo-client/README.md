# Remix with Apollo Client

This PR demonstrates using [Apollo Client](https://www.apollographql.com/docs/react/) and a readily available [GraphQL API](https://rickandmortyapi.com/graphql) working with Remix. We also make use of a [GraphQL Code Generator](https://www.graphql-code-generator.com) which automates the creation of strong typings and some handy React Hooks directly from our ".graphql" files.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/apollo-client)

## Example

There are two routes being used, each makes a request via Apollo client. The `index` route makes use of Remix Loaders whereas the details view `$id` uses react hooks to fetch the data. Both methods support server side rendering and custom loading/error handling.

## Related Links

- [Apollo Client](https://www.apollographql.com/docs/react/)
- [GraphQL Code Generator](https://www.graphql-code-generator.com)
- [GraphQL "Rick & Morty" API](https://rickandmortyapi.com/graphql)