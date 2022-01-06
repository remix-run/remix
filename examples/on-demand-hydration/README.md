# On-Demand JS Hydration

This examples show how you can, not only enable or disable JS statically using the `handle` export, but also do it on-demand based on the route data returned by the loader.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/on-demand-hydration)

## Example

The example has four routes, the `/` which has links to the rest and three more:

1. With JS
2. Without JS
3. On-Demand JS

The first one, shows how using `handle = { hydrate: true }`, we can enable the load of JS.

The second one, shows how by not exporting the `handle`, we can disable the load of JS.

The third one, shows how we can make the `hydrate` be a function, read the `loader` data there and use it to decide if we should load JS or not. The example uses a `?js` search param to enable it or not, but you could use actual data.

All examples use the `useShouldHydrate` hook from Remix Utils to know if it should render or not the Scripts component in the root route.

## Related Links

- [useShouldHydrate](https://github.com/sergiodxa/remix-utils#useshouldhydrate)
- [On-Demand Hydration with Remix](https://sergiodxa.com/articles/on-demand-hydration-in-remix) - Article showing more use cases for this technique.
