---
"@remix-run/dev": patch
---

Stabilize the `future.v3_routeConfig` future flag, replacing `future.unstable_routeConfig`. This enables support for `routes.ts` to assist with the migration to React Router v7.

Note that if you had already enabled the `future.unstable_routeConfig` flag, your route config in `app/routes.ts` is no longer defined via the `routes` export and must now be defined via the default export.

```diff
import { type RouteConfig } from "@remix-run/route-config";

-export const routes: RouteConfig = [];
+export default [] satisfies RouteConfig;
```
