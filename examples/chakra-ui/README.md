# Chackra UI Example

In this setup we will setup Chakra UI with Remix.

Please note that when adding Chakra UI to a TypeScript project, a minimum TypeScript version of `4.1.0` is required

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/chakra-ui)

## Example

This example shows how to use Chakra UI with Remix.

Check [app/root.tsx](./app/root.tsx) where Chakra UI is imported and provides context to the component tree.

Uncomment the thrown error on `./app/root.tsx` to see how Chackra UI handles your styles graciously on `CatchBoundary`. Then, navigate a **Not Found** route (like `/admin`) to see `ErrorBoundary` in action.

## Related Links

[Chakra UI](https://chakra-ui.com/guides/getting-started/remix-guide)
