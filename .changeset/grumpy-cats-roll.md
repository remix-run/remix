---
"@remix-run/dev": minor
---

Vite: Strict route exports

With Vite, Remix gets stricter about which exports are allowed from your route modules.
Previously, the Remix compiler would allow any export from routes.
While this was convenient, it was also a common source of bugs that were hard to track down because they only surfaced at runtime.

For more, see https://remix.run/docs/en/main/future/vite#strict-route-exports
