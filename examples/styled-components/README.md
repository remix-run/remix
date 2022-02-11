# Example app with [Styled Components](https://styled-components.com/)

This example features how to use [Styled Components](https://styled-components.com/) with Remix.

## Preview

Open this example on [CodeSandbox](https://codesandbox.io/s/styled-components):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/styled-components)

## Example

This example shows how to use Styled Components with Remix. Relevant files:

- [app/root.tsx](./app/root.tsx) - This is where we render the app and if we're rendering on the server we have placeholder text of `__STYLES__`.
- [app/entry.server.tsx](./app/entry.server.tsx) - This is where we render the app on the server and replace `__STYLES__` with the styles that styled-components collect.
- [app/routes/index.tsx](./app/routes/index.tsx) - Here's where we use the `styled` function to create a styled component.

## Related Links

[Styled-Components](https://styled-components.com/)
