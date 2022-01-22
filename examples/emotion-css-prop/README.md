# Example app with [Emotion](https://emotion.sh/docs/introduction) - css Prop

This example features how to use [Emotion](https://emotion.sh/docs/introduction) - css Prop with Remix.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/emotion-css-prop)

## Example

This example shows how to use Emotion - css Prop with Remix.

Relevant files:

- [app/root.tsx](./app/root.tsx) - This is where we render the app and if we're rendering on the server we have placeholder text of __STYLES__.
- [app/entry.server.tsx](./app/entry.server.tsx) - This is where we render the app on the server and replace __STYLES__ with the styles that emotion collect.
- [app/routes/index.tsx](./app/routes/index.tsx)  - Here's where we use the css Prop to styling component.
- [tsconfig.json](./tsconfig.json) - Add `jsxImportSource` to use the css Prop in tsx file.

## Related Links

- [Emotion](https://emotion.sh/docs/introduction)
- [The css Prop](https://emotion.sh/docs/css-prop)
- [emotion-reset](https://github.com/sayegh7/emotion-reset)
