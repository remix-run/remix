# useMatches example

Use the `useMatches` hook to access loader data across your application.

With Remix, you don't need global React contexts anymore to access your application state. Instead, you can use `useMatches` to access loader data across your application.

Note: if you have UI state (non-persisted state managed by React) then you'd probably want to look into [the `context` prop on `<Outlet />`](https://remix.run/docs/en/v1/api/remix#outlet-context-) combined with [the `useOutletContext` hook](https://remix.run/docs/en/v1/api/remix#useoutletcontext).

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/usematches-loader-data)

## Example

This example implements a `useMatchesData` hook as an abstraction of `useMatches`.
You can further build custom hooks (`useProjects`, `useUser`, etc.) around the `useMatchesData` hook for convenient access to your application data.

No need to use global React contexts anymore to access your React state.

- Check out the [useMatchesData](app/useMatchesData.ts) implementation to see how we use `useMatches`.
- Check out the [useOptionalUser](app/useOptionalUser.ts) implementation to see how to implement `useMatchesData` internally in custom hooks.
- Check out the [root](app/root.tsx) loader function, to see that we use loaders to return json data server-side for our routes.
- Check out the [index](app/routes/index.tsx) route, as an example for how to access loader data of parent and child routes across our application with our custom hooks.

## Related Links

This implementation works great together with [tiny-invariant](https://www.npmjs.com/package/tiny-invariant) to enforce that some loader data must be defined and of the right type. Follow the instructions in [useUser.ts](app/useUser.ts) for more information.

Also related to this example, the usage of the TypeScript keyword `is` to implement custom type guards. You can find more information in the [TypeScript documentation](https://www.typescriptlang.org/docs/handbook/advanced-types.html#using-type-predicates).
