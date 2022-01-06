# Client only components

Sometimes you need to render a, probably third-party, component that doesn't work server-side.

This can be a component using browser APIs inside the render or packages using browser APIs inside the module code making it impossible to import server-side.

This shows how to do that.

Also shows how to know JS loaded and enable a button that needs JS to work.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

<!-- TODO: update this link to the path for your example: -->

[![Open in codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/client-only-components)

## Example

The example has three use case:

A component reading from localStorage on the module code, this is named as `.client.tsx` so it's not imported server-side, then it's rendered with the ClientOnly component from Remix Utils.

A component reading from localStorage to initialize a state, this is not named `.client` because it can be imported server-side, but it's rendered within a ClientOnly component so avoid rendering it server-side.

A button of type button that needs JS to show an alert on click which detects if JS loaded (is hydrated) and once it loaded it enables the button.

Try disabling JS to see the button disabled and a loading component for the rest.

## Related Links

- [ClientOnly](https://github.com/sergiodxa/remix-utils#clientonly)
- [useHydrated](https://github.com/sergiodxa/remix-utils#usehydrated)
