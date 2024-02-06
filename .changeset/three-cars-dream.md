---
"@remix-run/express": patch
---

Use `req.originalUrl` instead of `req.url` so that Remix sees the full URL

- Remix relies on the knowing the full URL to ensure that server and client code can function together, and does not support URL rewriting prior to the Remix handler
