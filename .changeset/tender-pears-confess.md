---
"@remix-run/cloudflare": patch
"@remix-run/deno": patch
"@remix-run/node": patch
"@remix-run/server-runtime": patch
---

Single Fetch: Re-export `interface Future` through `@remix-run/node`/`@remix-run/cloudflare`/`@remix-run/deno` packages so that `pnpm` doesn't complain about `@remix-run/server-runtime` not being a dependency
