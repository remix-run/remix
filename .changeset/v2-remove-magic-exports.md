---
"remix": major
"@remix-run/cloudflare": major
"@remix-run/dev": major
"@remix-run/node": major
"@remix-run/react": major
"@remix-run/server-runtime": major
"@remix-run/testing": major
---

Removed support for "magic exports" from the `remix` package. This package can be removed from your `package.json` and you should update all imports to use the source `@remix-run/*` packages:

```diff
- import type { ActionArgs } from "remix";
- import { json, useLoaderData } from "remix";
+ import type { ActionArgs } from "@remix-run/node";
+ import { json } from "@remix-run/node";
+ import { useLoaderData } from "@remix-run/react";
```
