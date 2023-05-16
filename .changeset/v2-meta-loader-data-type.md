---
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

Fix `data` parameter typing on `V2_MetaFunction` to include `undefined` for scenarios in which the `loader` threw to it's own boundary.
