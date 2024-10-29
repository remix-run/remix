---
"@remix-run/dev": minor
---

Add support for `routes.ts` behind `future.v3_routeConfig` flag to assist with the migration to React Router v7.

Config-based routing is the new default in React Router v7, configured via the `routes.ts` file in the app directory. Support for `routes.ts` and its related APIs in Remix are designed as a migration path to help minimize the number of changes required when moving your Remix project over to React Router v7. While some new packages have been introduced within the `@remix-run` scope, these new packages only exist to keep the code in `routes.ts` as similar as possible to the equivalent code for React Router v7.

When the `v3_routeConfig` future flag is enabled, Remix's built-in file system routing will be disabled and your project will opted into React Router v7's config-based routing.

To enable the flag, in your `vite.config.ts` file:

```ts
remix({
  future: {
    v3_routeConfig: true,
  },
});
```

A minimal `routes.ts` file to support Remix's built-in file system routing looks like this:

```ts
// app/routes.ts
import { flatRoutes } from "@remix-run/fs-routes";
import type { RouteConfig } from "@remix-run/route-config";

export const routes: RouteConfig = flatRoutes();
```
