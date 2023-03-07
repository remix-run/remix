---
"remix": major
"@remix-run/cloudflare": major
"@remix-run/dev": major
"@remix-run/node": major
"@remix-run/react": major
"@remix-run/server-runtime": major
"@remix-run/testing": major
---

Removed support for "magic exports" from the `remix` package. Remix modules should be imported directly from their source package.

```diff
- import { useLoaderData, json, type ActionArgs } from "remix";
+ import { useLoaderData } from "@remix-run/react";
+ import { json, type ActionArgs } from "@remix-run/node";
```