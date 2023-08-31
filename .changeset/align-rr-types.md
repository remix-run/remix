---
"@remix-run/cloudflare": major
"@remix-run/deno": major
"@remix-run/node": major
"@remix-run/server-runtime": major
---

 Remove/Align Remix types with those use din React Router

* Remove Remix definitions of `LoaderFunction`/`ActionFunction` and re-export from React Router
* Remove `LoaderArgs`/`ActionArgs` and re-export `LoaderFunctionArgs`/`ActionFunctionArgs`  from React Router
* Change `AppLoadContext` from a keyed object in Remix to the `any` used in React Router to permit users to return anything from `getLoadContext`
