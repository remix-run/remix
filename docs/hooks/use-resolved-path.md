---
title: useResolvedPath
---

# `useResolvedPath`

Resolves the `pathname` of the given `to` value against the pathname of the current location and returns a `Path` object.

```tsx
import { useResolvedPath } from "@remix-run/react";

function SomeComponent() {
  const path = useResolvedPath("../some/where");
  path.pathname;
  path.search;
  path.hash;
  // ...
}
```

This is useful when building links from relative values and used internally for [`<NavLink>`][nav-link-component].

## Splat Paths

The original logic for React Router's `useResolvedPath` hook behaved differently for splat paths that in hindsight was incorrect/buggy behavior. Please see the [React Router Docs][rr-use-resolved-path-splat] for a longer explanation, but this was determined to be a "breaking bug fix" and was fixed behind a future flag in React Router and exposed up through a [`v3_relativeSplatPath`][remix-config-future] Future Flag in Remix. This will become the default behavior in Remix v3, so it is recommended to update your applications at your convenience to be better prepared for the eventual v3 upgrade.

It should be noted that this is the foundation for all relative routing in Remix, so this applies to the following relative path code flows as well:

- `<Link to>`
- `useNavigate()`
- `useHref()`
- `<Form action>`
- `useSubmit()`
- Relative path `redirect` responses returned from loaders and actions

### Behavior without the flag

When this flag is not enabled, the default behavior is that when resolving relative paths inside a splat route, the splat portion of the path is ignored. So, within a `routes/dashboard.$.tsx` file, `useResolvedPath(".")` would resolve to `/dashboard` even if the current URL was `/dashboard/teams`.

### Behavior with the flag

When you enable the flag, this "bug" is fixed so that path resolution is consistent across all route types, and `useResolvedPath(".")` always resolves to the current pathname for the contextual route. This includes any dynamic param or splat param values, so within a `routes/dashboard.$.tsx` file, `useResolvedPath(".")` would resolve to `/dashboard/teams` when the current URL was `/dashboard/teams`.

## Additional Resources

- [`resolvePath`][rr-resolve-path]

[nav-link-component]: ../components/nav-link
[rr-resolve-path]: https://reactrouter.com/v6/utils/resolve-path
[rr-use-resolved-path-splat]: https://reactrouter.com/v6/hooks/use-resolved-path#splat-paths
[remix-config-future]: https://remix.run/docs/en/main/file-conventions/remix-config#future
