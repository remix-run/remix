---
"@remix-run/dev": patch
"@remix-run/express": patch
---

Fix adapter logic for aborting `request.signal` so we don't incorrectly abort on the `close` event for successful requests
