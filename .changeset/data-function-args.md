---
"@remix-run/server-runtime": minor
"@remix-run/server-node": minor
"@remix-run/server-cloudflare": minor
"@remix-run/server-deno": minor
---

Deprecate `DataFunctionArgs` in favor of `LoaderFunctionArgs`/`ActionFunctionArgs`. This is aimed at keeping the types aligned across server/client loaders/actions now that `clientLoader`/`clientActon` functions have `serverLoader`/`serverAction` parameters which differentiate `ClientLoaderFunctionArgs`/`ClientActionFunctionArgs`.
