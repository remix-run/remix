# CatchBoundary Example

If you want to handle _expected_ errors, you use a `CatchBoundary` to catch those types of errors. Think about HTTP-400-level errors like unauthorized etc.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/catch-boundary)

## Example

In this example, we have a list of users and one user that does not exist. When you navigate to the user that does not exist, our CatchBoundary renders in place of the component for that route.

Check [app/routes/users/$userId.tsx](app/routes/users/$userId.tsx) to see the CatchBoundary in action.

## Related Links

- [CatchBoundary in the Remix Docs](https://remix.run/api/conventions#catchboundary)
