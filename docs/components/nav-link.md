---
title: NavLink
---

# `<NavLink>`

Wraps [`<Link>`][link_component] with additional props for styling active and pending states.

```tsx
import { NavLink } from "@remix-run/react";

<NavLink
  to="/messages"
  className={({ isActive, isPending }) =>
    isPending ? "pending" : isActive ? "active" : ""
  }
>
  Messages
</NavLink>;
```

## Automatic Attributes

### `.active`

An `active` class is added to a `<NavLink>` component when it is active, so you can use CSS to style it.

```tsx
<NavLink to="/messages" />
```

```css
a.active {
  color: red;
}
```

### `aria-current`

When a `NavLink` is active it will automatically apply `<a aria-current="page">` to the underlying anchor tag. See [aria_current][aria_current] on MDN.

### `.pending`

A `pending` class is added to a `<NavLink>` component when it is pending during a navigation, so you can use CSS to style it.

```tsx
<NavLink to="/messages" />
```

```css
a.pending {
  color: red;
}
```

### `.transitioning`

A `transitioning` class is added to a `<NavLink unstable_viewTransition>` component when it is transitioning during a navigation, so you can use CSS to style it.

```tsx
<NavLink to="/messages" unstable_viewTransition />
```

```css
a.transitioning {
  view-transition-name: my-transition;
}
```

## Props

### `className` callback

Calls back with the active and pending states to allow customizing the class names applied.

```tsx
<NavLink
  to="/messages"
  className={({ isActive, isPending }) =>
    isPending ? "pending" : isActive ? "active" : ""
  }
>
  Messages
</NavLink>
```

### `style` callback

Calls back with the active and pending states to allow customizing the styles applied.

```tsx
<NavLink
  to="/messages"
  style={({ isActive, isPending }) => {
    return {
      fontWeight: isActive ? "bold" : "",
      color: isPending ? "red" : "black",
    };
  }}
>
  Messages
</NavLink>
```

### `children` callback

Calls back with the active and pending states to allow customizing the content of the `<NavLink>`.

```tsx
<NavLink to="/tasks">
  {({ isActive, isPending }) => (
    <span className={isActive ? "active" : ""}>Tasks</span>
  )}
</NavLink>
```

### `end`

The `end` prop changes the matching logic for the `active` and `pending` states to only match to the "end" of the `NavLinks`'s `to` path. If the URL is longer than `to`, it will no longer be considered active.

| Link                          | URL          | isActive |
| ----------------------------- | ------------ | -------- |
| `<NavLink to="/tasks" />`     | `/tasks`     | true     |
| `<NavLink to="/tasks" />`     | `/tasks/123` | true     |
| `<NavLink to="/tasks" end />` | `/tasks`     | true     |
| `<NavLink to="/tasks" end />` | `/tasks/123` | false    |

`<NavLink to="/">` is an exceptional case because _every_ URL matches `/`. To avoid this matching every single route by default, it effectively ignores the `end` prop and only matches when you're at the root route.

### `caseSensitive`

Adding the `caseSensitive` prop changes the matching logic to make it case-sensitive.

| Link                                         | URL           | isActive |
| -------------------------------------------- | ------------- | -------- |
| `<NavLink to="/SpOnGe-bOB" />`               | `/sponge-bob` | true     |
| `<NavLink to="/SpOnGe-bOB" caseSensitive />` | `/sponge-bob` | false    |

## `unstable_viewTransition`

The `unstable_viewTransition` prop enables a [View Transition][view-transitions] for this navigation by wrapping the final state update in `document.startViewTransition()`. By default, during the transition a `transitioning` class will be added to the `<a>` element that you can use to customize the view transition.

```css
a.transitioning p {
  view-transition-name: "image-title";
}

a.transitioning img {
  view-transition-name: "image-expand";
}
```

```jsx
<NavLink to={to} unstable_viewTransition>
  <p>Image Number {idx}</p>
  <img src={src} alt={`Img ${idx}`} />
</NavLink>
```

You may also use the `className`/`style` props or the render props passed to `children` to further customize based on the `isTransitioning` value.

```jsx
<NavLink to={to} unstable_viewTransition>
  {({ isTransitioning }) => (
    <>
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
    </>
  )}
</NavLink>
```

<docs-warn>
Please note that this API is marked unstable and may be subject to breaking changes without a major release.
</docs-warn>

### `<Link>` props

All other props of [`<Link>`][link_component] are supported.

[link_component]: ./link
[aria_current]: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-current
[view-transitions]: https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
