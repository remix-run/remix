# Example app with [Styletron](https://styletron.org/)

This example features how to use [Styletron](https://styletron.org/) with Remix.

## Preview

Open this example on [CodeSandbox](https://codesandbox.io/s/remix-examples-styletron):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/styletron)

## Example

This example shows how to use Styletron with Remix.

### Relevant files

- [app/styletron.ts](./app/styletron.ts) - Here's where we handle the styletron-related logic.
- [app/root.tsx](./app/root.tsx) - This is where we render the app and if we're rendering on the server.
  - We indicate where we want the styles to be added by inserting `__STYLES__` at the bottom of `<head>`;
  - We wrap the `<Outlet>` with `<StyletronProvider value={styletron}>`
- [app/entry.server.tsx](./app/entry.server.tsx) - This is where we render the app on the server and replace `__STYLES__` with the styles that styletron collects.

## Related Links

[Styletron – Getting Started with React](https://styletron.org/getting-started#with-react)
