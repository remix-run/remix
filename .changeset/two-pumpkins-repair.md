---
"@remix-run/server-runtime": patch
---

Improve performance by using JSON.parse instead of an object literal loading the route manifest on the client.
