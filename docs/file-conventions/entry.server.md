---
title: entry.server
toc: false
---

# entry.server

By default, Remix will handle generating the HTTP Response for you. If you want to customize this behavior, you can run `npx remix reveal` to generate an `app/entry.server.tsx` (or `.jsx`) that will take precedence. The `default` export of this module is a function that lets you create the response, including HTTP status, headers, and HTML, giving you full control over the way the markup is generated and sent to the client.

This module should render the markup for the current page using a `<RemixServer>` element with the `context` and `url` for the current request. This markup will (optionally) be re-hydrated once JavaScript loads in the browser using the [browser entry module][browser-entry-module].

## `handleDataRequest`

You can export an optional `handleDataRequest` function that will allow you to modify the response of a data request. These are the requests that do not render HTML, but rather return the loader and action data to the browser once client-side hydration has occurred.

```tsx
export function handleDataRequest(
  response: Response,
  { request, params, context }: DataFunctionArgs
) {
  response.headers.set("X-Custom-Header", "value");
  return response;
}
```

## `onUnhandledError`

By default, Remix will log encountered server-side errors to the console. If you'd like more control over the logging, or would like to also report these errors to an external service, then you can export an optional `onUnhandledError` function which will give you control (and will disable the built-in error logging).

```tsx
export function onUnhandledError(
  error: Error | unknown,
  { request, params, context }: DataFunctionArgs
) {
  sendErrorToErrorReportingService(error);
  console.error(formatErrorForJsonLogging(error));
}
```

Note that this does not handle thrown `Response` instances from your `loader`/`action` functions. The intention of this handler is to find bugs in your code which result in unexpected thrown errors. If you are detecting a scenario and throwing a 401/404/etc. `Response` in your `loader`/`action` then it's an expected flow that is handled by your code. If you also wish to log, or send those to an external service, that should be done at the time you throw the response.

[browser-entry-module]: ./entry.client
