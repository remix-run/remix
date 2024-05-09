---
"@remix-run/server-runtime": patch
---

Remove `response` stub from `LoaderFunctionArgs`/`ActionFunctionArgs`

- Instead, you will need to use `defineLaoder`/`defineAction` with single fetch to gain type access to the `response` stub
