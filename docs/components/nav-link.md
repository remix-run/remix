---
title: NavLink
toc: false
---

# `<NavLink>`

A `<NavLink>` is a special kind of `<Link>` that knows whether or not it is "active". This is useful when building a navigation menu, such as a breadcrumb or a set of tabs where you'd like to show which of them is currently selected. It also provides useful context for assistive technology like screen readers.

By default, an `active` class is added to a `<NavLink>` component when it is active. You can pass a function as children to customize the content of the `<NavLink>` component based on their active state, specially useful to change styles on internal elements.

```tsx
import { NavLink } from "@remix-run/react";

function NavList() {
  // This styling will be applied to a <NavLink> when the
  // route that it links to is currently selected.
  const activeStyle = {
    textDecoration: "underline",
  };
  const activeClassName = "underline";
  return (
    <nav>
      <ul>
        <li>
          <NavLink
            to="messages"
            style={({ isActive }) =>
              isActive ? activeStyle : undefined
            }
          >
            Messages
          </NavLink>
        </li>
        <li>
          <NavLink
            to="tasks"
            className={({ isActive }) =>
              isActive ? activeClassName : undefined
            }
          >
            Tasks
          </NavLink>
        </li>
        <li>
          <NavLink to="tasks">
            {({ isActive }) => (
              <span
                className={
                  isActive ? activeClassName : undefined
                }
              >
                Tasks
              </span>
            )}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
```

If the `end` prop is used, it will ensure this component isn't matched as "active" when its descendant paths are matched. For example, to render a link that is only active at the website root and not any other URLs, you can use:

```tsx
<NavLink to="/" end>
  Home
</NavLink>
```
