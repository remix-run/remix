# Twind Example

Integrate Twind with Remix with SSR.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/twind)

## Example

This example shows how to use Twind in Remix. Twind is a small compiler (~13kB) that converts Tailwind utility classes into CSS at runtime.

Relevant files:

- [app/entry.server.tsx](./app/entry.server.tsx) where the twind styles have been added to the markup to enable server-side-rendering (SSR) of styles.
- [app/root.tsx](./app/root.tsx) where twind has been set up.
- [app/routes/index.tsx](./app/routes/index.tsx) and [app/routes/anything.tsx](./app/routes/anything.tsx) where some basic styling has been demonstrated.
- [remix.config.js](./remix.config.js) where the twind modules have been added to [`serverDependenciesToBundle`](https://remix.run/docs/en/v1/api/conventions#serverdependenciestobundle).
- [twind.config.ts](./twind.config.ts) (optional) where twind can be [configured](https://twind.dev/handbook/configuration.html).

## Related Links

[Twind](https://twind.dev/)
