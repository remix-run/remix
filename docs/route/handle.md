---
title: handle
---

# `handle`

Exporting a handle allows you to create application conventions with the [`useMatches`][use-matches] hook. You can put whatever values you want on it:

```tsx
import {RouteHandle} from '@remix-run/react/dist/routeModules'

export const handle: RouteHandle = {
  pageType: "Home",
  i18n: "en"
};
```

You can augment `RouteHandle` with your own app's object shape:

```ts
// remix.d.ts

declare module '@remix-run/react/dist/routeModules' {
  interface RouteHandle {
    pageType: string
    subscriptionRequired?: boolean
    i18n?: string
  }
}
```

This is almost always used in conjunction with `useMatches`. To see what kinds of things you can do with it, refer to [`useMatches`][use-matches] for more information.

## Additional Resources

- [Breadcrumbs Guide][breadcrumbs-guide]
- [`useMatches`][use-matches]

[use-matches]: ../hooks/use-matches
[breadcrumbs-guide]: ../guides/breadcrumbs
