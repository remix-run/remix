# Remix + MSW

This example demonstrates [MSW's][msw] usage with Remix to mock external APIs called from the Remix server during development.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/msw)

## Example

If the external APIs are metered and charged for the number of API calls made, it's pretty easy to burst through the API quota during development. Also, we need an active network during development. For some, this may be an issue. So instead, we can mock the external API using MSW, which intercepts the API calls from the server and returns a mocked response.

## Relevant files

- [mocks](./mocks/index.js)

- [package.json](./package.json)

## Related Links

- [MSW][msw]

[msw]: https://mswjs.io/
