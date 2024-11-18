---
"@remix-run/dev": patch
---

When the `future.unstable_routeConfig` flag is enabled, your route config in `app/routes.ts` is no longer defined via the `routes` export and must now be defined via the default export.

```diff
import { type RouteConfig } from "@remix-run/route-config";

-export const routes: RouteConfig = [];
+export default [] satisfies RouteConfig;
```
