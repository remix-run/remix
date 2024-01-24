---
"@remix-run/cloudflare-pages": patch
"@remix-run/dev": patch
"@remix-run/server-runtime": patch
---

Vite: Cloudflare Pages support

Note that [Cloudflare Workers are deprecated](https://developers.cloudflare.com/workers/configuration/sites/),
so the Remix Vite plugin only officially supports Cloudflare Pages.
Cloudflare Workers may work, but are not officially supported nor tested.

To get started with Cloudflare, you can use the [`unstable-vite-cloudflare`][template-vite-cloudflare] template:

```shellscript nonumber
npx create-remix@latest --template remix-run/remix/templates/unstable-vite-cloudflare
```

Or read the new docs at [Future > Vite > Cloudflare](https://remix.run/docs/en/main/future/vite#cloudflare)
