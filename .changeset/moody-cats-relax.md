---
"remix": patch
"@remix-run/node": patch
---

chore: update @remix-run/web-fetch to 4.3.2

-  fix: Memory leak caused by unregistered listeners. Solution was copied from a node-fetch pr.
-  fix: Add support for custom "credentials" value. Nothing is done with them at the moment but they pass through for the consumer of the request to access if needed.
