# Chackra UI Example

In this setup we will setup Chakra UI with Remix.

Please note that when adding Chakra UI to a TypeScript project, a minimum TypeScript version of `4.1.0` is required

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/chakra-ui)

## Example

This example shows how to use Chakra UI with Remix.

Check [app/root.tsx](./app/root.tsx) where Chakra UI is imported and providing context to the component tree.

> You'll need to setup the `ChakraProvider` in every other place when the full `Document` gets replaced as in `ErrorBoundary` and `CatchBoundary`.

## Related Links

[Chakra UI](https://chakra-ui.com/guides/getting-started/remix-guide)
