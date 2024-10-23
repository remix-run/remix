---
"@remix-run/dev": minor
---

Add unstable support for `routes.ts` to assist with the migration to React Router v7.

Config-based routing is the new default in React Router v7. Support for `routes.ts` and its related APIs in Remix are designed as a migration path to help minimize the number of changes required when moving your Remix project over to React Router v7. Since React Router v7 is not yet stable, these APIs are also considered unstable.

The presence of an `app/routes.ts` file when using the Remix Vite plugin will disable Remix's built-in file system routing and opt your project into React Router v7's config-based routing.

A minimal `routes.ts` file to support Remix's built-in file system routing looks like this:

```ts
// app/routes.ts
import { flatRoutes } from "@remix-run/fs-routes";
import type { RouteConfig } from "@remix-run/route-config";

export const routes: RouteConfig = flatRoutes();
```
