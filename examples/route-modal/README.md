# Route modal

Example of using routes to control visibility of modals.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/route-modal)

## Example

This example shows how to use routes to show/hide modals.

Using routes has some advantages over `useState` or other state management solutions.

- You can share links to open modals (eg. edit modal of a specific data row)
- No need for state variables

This example uses `@reach/dialog` for displaying the modals.

## Related Links

[React Router v6 Modal example](https://reactrouterdotcom.fly.dev/docs/en/v6/examples/modal)
