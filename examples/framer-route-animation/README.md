# Route Animations using Framer Motion

Animate route transition using Framer Motion `AnimatePresence` API and React Router `useOutlet`

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/framer-route-animation)

## Example

This example demonstrates adding route animations to Remix apps using Framer Motion. Framer provides `AnimatePresence` API, which animates DOM elements mounted and unmounted from the DOM. So when we navigate from one route to another, essentially, we're unmounting the previous route and mounting the new route. We can use this to animate route transitions.

The `Outlet` component from Remix will always render the currently active route. This is the expected behaviour in most cases; it does not work well with the `AnimatePresense` API. Furthermore, since Outlet replaces the currently active route, AnimatePresense does not know what has changed and what has to be animated. Instead, we can use the `useOutlet` hook, which returns the element for the active child route. This provides the required information for Framer to animate the mount and unmount of the component from the DOM. And since we want to trigger the animation on route change, we should also unmount and mount the enclosing Framer component. We can use the `useLocation` hook for that.

## Relevant files

- [root.tsx](./app/root.tsx)

## Related Links

- [useOutlet](https://reactrouter.com/docs/en/v6/api#useoutlet)
- [useLocation](https://reactrouter.com/docs/en/v6/api#uselocation)
- [Framer Motion](https://www.framer.com/docs/introduction/)
