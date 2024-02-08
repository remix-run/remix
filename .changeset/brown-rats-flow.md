---
"@remix-run/cloudflare-pages": minor
---

Make `getLoadContext` optional for Cloudflare Pages

Defaults to `(context) => ({ env: context })`, which is what we used to have in all the templates.
This gives parity with the Cloudflare preset for the Remix Vite plugin and keeps our templates leaner.
