---
"@remix-run/cloudflare": minor
"@remix-run/deno": minor
"@remix-run/node": minor
"@remix-run/server-runtime": minor
---

Deprecate `DataFunctionArgs` in favor of `LoaderFunctionArgs`/`ActionFunctionArgs`. This is aimed at keeping the types aligned across server/client loaders/actions now that `clientLoader`/`clientActon` functions have `serverLoader`/`serverAction` parameters which differentiate `ClientLoaderFunctionArgs`/`ClientActionFunctionArgs`.
