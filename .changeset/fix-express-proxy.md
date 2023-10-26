---
"@remix-run/express": patch
---

Allow the `@remix-run/express` adapter to work behind a proxy when using `app.enable('trust proxy')`

- Previously, this used `req.get('host')` to construct the Remix `Request`, but that does not respect `X-Forwarded-Host`
- This now uses `req.hostname` which will respect `X-Forwarded-Host`
