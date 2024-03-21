---
title: useNavigate
---

# `useNavigate`

The `useNavigate` hook returns a function that lets you navigate programmatically in the browser in response to user interactions or effects.

```tsx
import { useNavigate } from "@remix-run/react";

function SomeComponent() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        navigate(-1);
      }}
    />
  );
}
```

It's often better to use [`redirect`][redirect] in [`action`][action]s and [`loader`][loader]s than this hook, but it still has use cases.

## Arguments

### `to: string`

The most basic usage takes an href string:

```tsx
navigate("/some/path");
```

Paths can be relative:

```tsx
navigate("..");
navigate("../other/path");
```

<docs-info>Please see the [Splat Paths][relativesplatpath] section on the `useResolvedPath` docs for a note on the behavior of the `future.v3_relativeSplatPath` future flag for relative `useNavigate()` behavior within splat routes</docs-info>

### `to: Partial<Path>`

You can also pass a `Partial<Path>` value:

```tsx
navigate({
  pathname: "/some/path",
  search: "?query=string",
  hash: "#hash",
});
```

### `to: Number`

Passing a number will tell the browser to go back or forward in the history stack:

```tsx
navigate(-1); // go back
navigate(1); // go forward
navigate(-2); // go back two
```

Note that this may send you out of your application since the history stack of the browser isn't scoped to just your application.

### `options`

The second argument is an options object:

```tsx
navigate(".", {
  replace: true,
  relative: "path",
  state: { some: "state" },
});
```

- **replace**: boolean - replace the current entry in the history stack instead of pushing a new one
- **relative**: `"route" | "path"` - defines the relative path behavior for the link
  - `"route"` will use the route hierarchy so `".."` will remove all URL segments of the current route pattern while `"path"` will use the URL path so `".."` will remove one URL segment
- **state**: any - adds persistent client side routing state to the next location
- **preventScrollReset**: boolean - if you are using [`<ScrollRestoration>`][scroll-restoration], prevent the scroll position from being reset to the top of the window when navigating
- **unstable_flushSync**: boolean - wraps the initial state update for this navigation in a [`ReactDOM.flushSync`][flush-sync] call instead of the default [`React.startTransition`][start-transition]
- **unstable_viewTransition**: boolean - enables a [View Transition][view-transitions] for this navigation by wrapping the final state update in `document.startViewTransition()`
  - If you need to apply specific styles for this view transition, you will also need to leverage the [`unstable_useViewTransitionState()`][use-view-transition-state]

[redirect]: ../utils/redirect
[flush-sync]: https://react.dev/reference/react-dom/flushSync
[start-transition]: https://react.dev/reference/react/startTransition
[view-transitions]: https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
[use-view-transition-state]: ../hooks//use-view-transition-state
[action]: ../route/action
[loader]: ../route/loader
[relativesplatpath]: ./use-resolved-path#splat-paths
[scroll-restoration]: ../components/scroll-restoration#preventing-scroll-reset
