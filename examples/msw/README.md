# Remix + MSW

This example demonstrates [MSW's][msw] usage with Remix to mock any HTTP calls from the Remix server during development.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/msw)

## Example

- If the API is still under development and we don't want to wait for the API to be completed.
- We want to simulate various edge and error cases of making an HTTP call and check how the app handles these cases.
- If the external APIs are metered and charged for the number of API calls made, it's pretty easy to burst through the API quota during development.
- We need an active network during development if we rely on external HTTP calls for the app to work. For some, this may be an issue.

We can mock the HTTP calls using MSW, which intercepts the API calls from the server and returns a mocked response.

You can read more about the use cases of MSW [here](https://mswjs.io/docs/#when-to-mock-api)

## Gotchas

MSW currently does not support intercepting requests made by [undici](https://undici.nodejs.org/#/). For local development, Cloudflare Workers and Pages simulates the production environment using [wrangler](https://developers.cloudflare.com/workers/cli-wrangler), which intern runs [miniflare](https://github.com/cloudflare/miniflare). `Miniflare` implements `fetch` using `undici` instead of `node-fetch`. You can follow this issue [#159](https://github.com/mswjs/interceptors/issues/159) to track the progress.

## Relevant files

- [mocks](./mocks/index.js) - registers the Node HTTP mock server
- [handlers](./mocks/handlers.js) - describes the HTTP mocks
- [root](./app/root.tsx)
- [package.json](./package.json)

## Related Links

[MSW][msw]

[msw]: https://mswjs.io/
