# TODO: Title of Example

Integrate Twind with Remix

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/twind)

## Example

This example shows how to use Twind in Remix. Twind is a small compiler (~13kB) that converts Tailwind utility classes into CSS at runtime.

Relevant files:

- [app/twind.ts](./app/twind.ts) where a set up function has been exported.
- [app/entry.client.tsx](./app/entry.client.tsx) where the set up function has been used.
- [app/entry.server.tsx](./app/entry.server.tsx) where the twind styles have been added to the markup.
- [app/root.tsx](./app/root.tsx), [app/routes/index.tsx](./app/routes/index.tsx), [app/routes/anything.tsx](./app/routes/anything.tsx) where some basic styling has been demonstrated.


## Related Links

[Twind](https://twind.dev/)
