---
title: Link
---

# `<Link>`

A `<a href>` wrapper to enable navigation with client-side routing.

```tsx
import { Link } from "@remix-run/react";

<Link to="/dashboard">Dashboard</Link>;
```

<docs-info>Please see the [Splat Paths][relativesplatpath] section on the `useResolvedPath` docs for a note on the behavior of the `future.v3_relativeSplatPath` future flag for relative `<Link to>` behavior within splat routes</docs-info>

## Props

### `to: string`

The most basic usage takes an href string:

```tsx
<Link to="/some/path" />
```

### `to: Partial<Path>`

You can also pass a `Partial<Path>` value:

```tsx
<Link
  to={{
    pathname: "/some/path",
    search: "?query=string",
    hash: "#hash",
  }}
/>
```

### `discover`

Defines the route discovery behavior when using [future.unstable_fogOfWar][fog-of-war].

```tsx
<>
  <Link /> {/* defaults to "render" */}
  <Link discover="none" />
</>
```

- **render** - default, discover the route when the link renders
- **none** - don't eagerly discover, only discover if the link is clicked

### `prefetch`

Defines the data and module prefetching behavior for the link.

```tsx
<>
  <Link /> {/* defaults to "none" */}
  <Link prefetch="none" />
  <Link prefetch="intent" />
  <Link prefetch="render" />
  <Link prefetch="viewport" />
</>
```

- **none** - default, no prefetching
- **intent** - prefetches when the user hovers or focuses the link
- **render** - prefetches when the link renders
- **viewport** - prefetches when the link is in the viewport, very useful for mobile

Prefetching is done with HTML `<link rel="prefetch">` tags. They are inserted after the link.

```tsx
<nav>
  <a href="..." />
  <a href="..." />
  <link rel="prefetch" /> {/* might conditionally render */}
</nav>
```

Because of this, if you are using `nav :last-child` you will need to use `nav :last-of-type` so the styles don't conditionally fall off your last link (and any other similar selectors).

### `preventScrollReset`

If you are using [`<ScrollRestoration>`][scroll-restoration-component], this lets you prevent the scroll position from being reset to the top of the window when the link is clicked.

```tsx
<Link to="?tab=one" preventScrollReset />
```

This does not prevent the scroll position from being restored when the user comes back to the location with the back/forward buttons, it just prevents the reset when the user clicks the link.

<details>

<summary>Discussion</summary>

An example when you might want this behavior is a list of tabs that manipulate the url search params that aren't at the top of the page. You wouldn't want the scroll position to jump up to the top because it might scroll the toggled content out of the viewport!

```text
      ┌─────────────────────────┐
      │                         ├──┐
      │                         │  │
      │                         │  │ scrolled
      │                         │  │ out of view
      │                         │  │
      │                         │ ◄┘
    ┌─┴─────────────────────────┴─┐
    │                             ├─┐
    │                             │ │ viewport
    │   ┌─────────────────────┐   │ │
    │   │  tab   tab   tab    │   │ │
    │   ├─────────────────────┤   │ │
    │   │                     │   │ │
    │   │                     │   │ │
    │   │ content             │   │ │
    │   │                     │   │ │
    │   │                     │   │ │
    │   └─────────────────────┘   │ │
    │                             │◄┘
    └─────────────────────────────┘

```

</details>

### `relative`

Defines the relative path behavior for the link.

```tsx
<Link to=".." />; // default: "route"
<Link relative="route" />;
<Link relative="path" />;
```

- **route** - default, relative to the route hierarchy so `..` will remove all URL segments of the current route pattern
- **path** - relative to the path so `..` will remove one URL segment

### `reloadDocument`

Will use document navigation instead of client side routing when the link is clicked, the browser will handle the transition normally (as if it were an `<a href>`).

```tsx
<Link to="/logout" reloadDocument />
```

### `replace`

The `replace` prop will replace the current entry in the history stack instead of pushing a new one onto it.

```tsx
<Link replace />
```

```
# with a history stack like this
A -> B

# normal link click pushes a new entry
A -> B -> C

# but with `replace`, B is replaced by C
A -> C
```

### `state`

Adds persistent client side routing state to the next location.

```tsx
<Link to="/somewhere/else" state={{ some: "value" }} />
```

The location state is accessed from the `location`.

```tsx
function SomeComp() {
  const location = useLocation();
  location.state; // { some: "value" }
}
```

This state is inaccessible on the server as it is implemented on top of [`history.state`][history-state].

## `unstable_viewTransition`

The `unstable_viewTransition` prop enables a [View Transition][view-transitions] for this navigation by wrapping the final state update in [`document.startViewTransition()`][document-start-view-transition]:

```jsx
<Link to={to} unstable_viewTransition>
  Click me
</Link>
```

If you need to apply specific styles for this view transition, you will also need to leverage the [`unstable_useViewTransitionState()`][use-view-transition-state]:

```jsx
function ImageLink(to) {
  const isTransitioning =
    unstable_useViewTransitionState(to);
  return (
    <Link to={to} unstable_viewTransition>
      <p
        style={{
          viewTransitionName: isTransitioning
            ? "image-title"
            : "",
        }}
      >
        Image Number {idx}
      </p>
      <img
        src={src}
        alt={`Img ${idx}`}
        style={{
          viewTransitionName: isTransitioning
            ? "image-expand"
            : "",
        }}
      />
    </Link>
  );
}
```

<docs-warning>
Please note that this API is marked unstable and may be subject to breaking changes without a major release.
</docs-warning>

[scroll-restoration-component]: ./scroll-restoration
[history-state]: https://developer.mozilla.org/en-US/docs/Web/API/History/state
[view-transitions]: https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
[document-start-view-transition]: https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition
[use-view-transition-state]: ../hooks/use-view-transition-state
[relativesplatpath]: ../hooks/use-resolved-path#splat-paths
[fog-of-war]: ../guides/fog-of-war
