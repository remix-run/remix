# Example with Apollo Client

This PR demonstrates using [Apollo Client](https://www.apollographql.com/docs/react/) and a readily available [GraphQL API](https://rickandmortyapi.com/graphql) working with Remix. Additionally I've opted to add in a [codegen](https://www.graphql-code-generator.com) setup which automates the creation of types and react hooks.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

<!-- TODO: update this link to the path for your example: -->

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/apollo-client-example/examples/apollo-client)

## Example

There are two routes being used, each makes a request via Apollo client. The `index` route makes use of Remix Loaders whereas the details view `$id` uses react hooks to fetch the data. Both methods support server side rendering and custom loading/error handling.

## Related Links

- [Apollo Client](https://www.apollographql.com/docs/react/)
- [GraphQL Code Generator](https://www.graphql-code-generator.com)
- [GraphQL "Rick & Morty" API](https://rickandmortyapi.com/graphql)